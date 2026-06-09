import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RepaymentRecordResponseDto } from './dto/repayment-record-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CollectorSummaryQueryDto } from './dto/collector-summary-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';
import {
  getShanghaiYmdParts,
  getShanghaiBusinessDate,
  getBusinessDayTimestampRange,
} from '../common/business-date';
import { AccessScopeService } from '../access-scope/access-scope.service';
import {
  calcLoanDisbursementDelta,
  calcLoanDisbursementDeltaTotal,
  calcPaidAmountTotal,
} from '../common/loan-account-math';
import {
  buildReductionWhereFromLoanScope,
  findReductionItems,
  ReductionBalanceItem,
  sumReductionAmount,
} from '../common/reduction-balance';

type DailyLoanBalanceItemType =
  | 'TODAY_LOAN'
  | 'TODAY_REPAY'
  | 'TODAY_EARLY_SETTLEMENT';

type DailyLoanBalanceItem = {
  loanId: number;
  amount: number;
  type: DailyLoanBalanceItemType;
  label: string;
  isEarlySettlement: boolean;
  isOverdueRepaid: boolean;
  remark: string;
};

type DepositProcessResult = {
  startBalance: number;
  todayDelta: number;
  line1Expression: string;
  rcBreakdown: { id: number; name: string; amount: number }[];
  line2Expression: string;
  rcTotal: number;
};

type DailyLoanBalanceResult = {
  previousTotal: number;
  todayLoanTotal: number;
  todayRepaidTotal: number;
  todayReductionTotal: number;
  todayTotal: number;
  todayLoanItems: DailyLoanBalanceItem[];
  todayRepaidItems: DailyLoanBalanceItem[];
  todayReductionItems: ReductionBalanceItem[];
  expression: {
    todayLoans: string;
    todayRepayments: string;
    summary: string;
  };
  date: string;
  userId: number;
};

@Injectable()
export class RepaymentRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  async findAllWithPagination(
    query: PaginationQueryDto,
    requestUserId: number,
  ): Promise<any> {
    const {
      page = 1,
      pageSize = 20,
      userId,
      loanId,
      startDate,
      endDate,
      riskControllerId,
      collectorId,
      username,
    } = query;
    const skip = (page - 1) * pageSize;
    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestUserId,
      collectorId ? Number(collectorId) : undefined,
      riskControllerId ? Number(riskControllerId) : undefined,
    );

    const where: any = {
      loan_account: scope.whereClause,
    };
    if (userId) where.user_id = userId;
    if (loanId) {
      where.AND = [...(where.AND || []), { loan_id: loanId }];
    }
    if (username) {
      where.user = {
        username: { contains: username.trim() },
      };
    }

    if (startDate || endDate) {
      where.paid_at = {};
      if (startDate) where.paid_at.gte = new Date(startDate);
      if (endDate) where.paid_at.lt = new Date(endDate);
    }

    const [records, total] = await Promise.all([
      this.prisma.repaymentRecord.findMany({
        where,
        include: {
          user: true,
          actual_collector: true,
          loan_account: true,
        },
        orderBy: { paid_at: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.repaymentRecord.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getScopedRepaymentSummary(
    query: CollectorSummaryQueryDto,
    requestUserId: number,
  ) {
    const collectorId = query.collectorId;
    const riskControllerId = query.riskControllerId;
    const { targetDate } = query;
    const refDate = targetDate ? new Date(targetDate) : new Date();
    const businessDate = getShanghaiBusinessDate(refDate);
    const yesterdayBusinessDate = new Date(
      businessDate.getTime() - 24 * 60 * 60 * 1000,
    );
    const { start: dayStart, end: dayEnd } =
      getBusinessDayTimestampRange(businessDate);
    const { start: yesterday, end: yesterdayEnd } =
      getBusinessDayTimestampRange(yesterdayBusinessDate);

    // Month range: from the 1st of Shanghai month at 06:00 to start of next month at 06:00
    // Approximate with calendar month start (good enough for monthly totals)
    const shanghaiParts = getShanghaiYmdParts(refDate);
    const monthStart = new Date(
      Date.UTC(shanghaiParts.y, shanghaiParts.m - 1, 1) - 2 * 3600 * 1000,
    );
    const nextMonthStart = new Date(
      Date.UTC(shanghaiParts.y, shanghaiParts.m, 1) - 2 * 3600 * 1000,
    );

    const [scope, requestUser] = await Promise.all([
      this.accessScopeService.resolveLoanAccountScope(
        requestUserId,
        collectorId,
        riskControllerId,
      ),
      this.prisma.staff.findUnique({
        where: { id: requestUserId },
        select: { role: true },
      }),
    ]);
    const baseWhere: any = {
      loan_account: scope.whereClause,
    };

    // Determine collectorId for deposit process (only for COLLECTOR role)
    let collectorIdForDeposit: number | null = null;
    if (requestUser?.role === 'COLLECTOR') {
      collectorIdForDeposit = requestUserId;
    } else if (requestUser?.role === 'ADMIN') {
      if (collectorId) {
        collectorIdForDeposit = collectorId;
      }
    }

    const [todayRecords, yesterdayRecords, monthRecords] = await Promise.all([
      this.prisma.repaymentRecord.findMany({
        where: { ...baseWhere, paid_at: { gte: dayStart, lt: dayEnd } },
        select: { paid_amount: true, loan_id: true },
      }),
      this.prisma.repaymentRecord.findMany({
        where: { ...baseWhere, paid_at: { gte: yesterday, lt: yesterdayEnd } },
        select: { paid_amount: true },
      }),
      this.prisma.repaymentRecord.findMany({
        where: {
          ...baseWhere,
          paid_at: { gte: monthStart, lt: nextMonthStart },
        },
        select: { paid_amount: true },
      }),
    ]);

    const [
      yesterdayDailyBalance,
      todayDailyBalance,
      todayDepositProcess,
      yesterdayDepositProcess,
    ] = await Promise.all([
      this.getDailyLoanBalance({
        requestUserId,
        targetDate: new Date(
          yesterdayBusinessDate.getTime() + 2 * 3600 * 1000 + 12 * 3600 * 1000,
        ),
        collectorId,
        riskControllerId,
        persist: false,
      }),
      this.getDailyLoanBalance({
        requestUserId,
        targetDate: new Date(
          businessDate.getTime() + 2 * 3600 * 1000 + 12 * 3600 * 1000,
        ),
        collectorId,
        riskControllerId,
        persist: false,
      }),
      collectorIdForDeposit
        ? this.buildDepositProcess(collectorIdForDeposit, dayStart, dayEnd)
        : Promise.resolve(null),
      collectorIdForDeposit
        ? this.buildDepositProcess(
            collectorIdForDeposit,
            yesterday,
            yesterdayEnd,
          )
        : Promise.resolve(null),
    ]);

    return {
      monthAmount: monthRecords.reduce(
        (sum, r) => sum + Number(r.paid_amount ?? 0),
        0,
      ),
      yesterdayAmount: yesterdayRecords.reduce(
        (sum, r) => sum + Number(r.paid_amount ?? 0),
        0,
      ),
      todayAmount: todayRecords.reduce(
        (sum, r) => sum + Number(r.paid_amount ?? 0),
        0,
      ),
      todayCount: new Set(todayRecords.map((r) => r.loan_id)).size,
      yesterdayDailyBalance,
      todayDailyBalance,
      todayDepositProcess,
      yesterdayDepositProcess,
    };
  }

  async getDailyLoanBalance(params: {
    requestUserId: number;
    targetDate?: Date;
    collectorId?: number;
    riskControllerId?: number;
    persist?: boolean;
  }): Promise<DailyLoanBalanceResult> {
    const {
      requestUserId,
      targetDate = new Date(),
      collectorId,
      riskControllerId,
      persist = false,
    } = params;
    const businessDate = getShanghaiBusinessDate(targetDate);
    const { start: dayStart, end: dayEnd } =
      getBusinessDayTimestampRange(businessDate);

    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestUserId,
      collectorId,
      riskControllerId,
    );
    const scopedBalanceUserId = scope.isAllAccessible
      ? requestUserId
      : scope.scopedUserId || requestUserId;

    const loansWhere: any = {
      ...scope.whereClause,
      created_at: { gte: dayStart, lt: dayEnd },
    };

    const repaymentWhere: any = {
      loan_account: scope.whereClause,
      paid_at: { gte: dayStart, lte: dayEnd },
    };
    const reductionWhere = buildReductionWhereFromLoanScope(scope.whereClause);

    let previousTotal = 0;
    let previousRow: any = null;

    if (collectorId || riskControllerId || scope.isAllAccessible) {
      // 交集模式或 admin 全量模式下，动态算出之前的累计余额（避免读取陈旧归档）
      const [loansBefore, repaymentsBefore, reductionsBefore] = await Promise.all([
        this.prisma.loanAccount.aggregate({
          where: {
            ...scope.whereClause,
            created_at: { lt: dayStart },
          },
          _sum: {
            company_cost: true,
            handling_fee: true,
          },
        }),
        this.prisma.repaymentRecord.aggregate({
          where: {
            loan_account: scope.whereClause,
            paid_at: { lt: dayStart },
          },
          _sum: {
            paid_amount: true,
          },
        }),
        sumReductionAmount(this.prisma, reductionWhere, { lt: dayStart }),
      ]);
      const totalLentBefore = calcLoanDisbursementDelta({
        company_cost: loansBefore._sum.company_cost,
        handling_fee: loansBefore._sum.handling_fee,
      });
      const totalRepaidBefore = calcPaidAmountTotal([
        { paid_amount: repaymentsBefore._sum.paid_amount },
      ]);

      previousTotal = totalLentBefore + totalRepaidBefore - reductionsBefore;
    } else {
      // 单用户模式下，从数据库归档表获取前一日的今日合计
      previousRow = await this.prisma.dailyLoanBalance.findFirst({
        where: {
          admin_id: scopedBalanceUserId,
          date: { lt: businessDate },
        },
        orderBy: { date: 'desc' },
      });
      previousTotal = Number(previousRow?.today_total ?? 0);
    }

    const [todayLoans, todayRepayments, todayReductionItems] = await Promise.all([
      this.prisma.loanAccount.findMany({
        where: loansWhere,
        select: {
          id: true,
          company_cost: true,
          handling_fee: true,
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.repaymentRecord.findMany({
        where: repaymentWhere,
        select: {
          loan_id: true,
          paid_amount: true,
          remark: true,
          paid_at: true,
          is_overdue_repaid: true,
        },
        orderBy: { paid_at: 'asc' },
      }),
      findReductionItems(this.prisma, reductionWhere, dayStart, dayEnd),
    ]);

    const todayLoanItems: DailyLoanBalanceItem[] = todayLoans.map((loan) => {
      const amount = calcLoanDisbursementDelta(loan);
      return {
        loanId: loan.id,
        amount,
        type: 'TODAY_LOAN',
        label: '借出',
        isEarlySettlement: false,
        isOverdueRepaid: false,
        remark: '',
      };
    });

    const todayRepaidItems: DailyLoanBalanceItem[] = todayRepayments.map(
      (row) => {
        const remark = row.remark ?? '';
        const isEarlySettlement = remark === '提前结清';
        const isOverdue = !!row.is_overdue_repaid;
        return {
          loanId: row.loan_id,
          amount: Number(row.paid_amount ?? 0),
          type: isEarlySettlement ? 'TODAY_EARLY_SETTLEMENT' : 'TODAY_REPAY',
          label: isEarlySettlement ? '清' : isOverdue ? '补' : '',
          isEarlySettlement,
          isOverdueRepaid: isOverdue,
          remark,
        };
      },
    );

    const todayLoanTotal = calcLoanDisbursementDeltaTotal(todayLoans);
    const todayRepaidTotal = calcPaidAmountTotal(
      todayRepaidItems.map((item) => ({ paid_amount: item.amount })),
    );
    const todayReductionTotal = todayReductionItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const todayNetRepaidTotal = todayRepaidTotal - todayReductionTotal;
    const todayTotal =
      previousTotal + todayLoanTotal + todayNetRepaidTotal;

    const result: DailyLoanBalanceResult = {
      previousTotal,
      todayLoanTotal,
      todayRepaidTotal,
      todayReductionTotal,
      todayTotal,
      todayLoanItems,
      todayRepaidItems,
      todayReductionItems,
      expression: {
        todayLoans: this.formatTodayLoansExpression(todayLoans, todayLoanTotal),
        todayRepayments: this.formatRepaymentsWithReductionsExpression(
          todayRepaidItems,
          todayRepaidTotal,
          todayReductionItems,
          todayReductionTotal,
        ),
        summary: `${this.formatNumber(previousTotal)} ${this.formatSigned(todayLoanTotal)} ${this.formatSigned(todayNetRepaidTotal)} = ${this.formatNumber(todayTotal)}`,
      },
      date: businessDate.toISOString().slice(0, 10),
      userId: scopedBalanceUserId,
    };

    if (persist) {
      await this.prisma.dailyLoanBalance.upsert({
        where: {
          admin_id_date: {
            admin_id: scopedBalanceUserId,
            date: businessDate,
          },
        },
        update: {
          previous_total: previousTotal,
          today_loan_total: todayLoanTotal,
          today_repaid_total: todayRepaidTotal,
          today_total: todayTotal,
          today_loan_items: result.todayLoanItems as any,
          today_repaid_items: result.todayRepaidItems as any,
        },
        create: {
          admin_id: scopedBalanceUserId,
          date: businessDate,
          previous_total: previousTotal,
          today_loan_total: todayLoanTotal,
          today_repaid_total: todayRepaidTotal,
          today_total: todayTotal,
          today_loan_items: result.todayLoanItems as any,
          today_repaid_items: result.todayRepaidItems as any,
        },
      });
    }

    return result;
  }

  async upsertDailyLoanBalanceForDate(
    requestUserId: number,
    targetDate: Date,
  ): Promise<DailyLoanBalanceResult> {
    return this.getDailyLoanBalance({
      requestUserId,
      targetDate,
      persist: true,
    });
  }

  async getDailySummary(query: DailySummaryQueryDto, requestUserId: number) {
    const collectorId = query.collectorId;
    const riskControllerId = query.riskControllerId;
    const { month } = query;
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;

    // Use 06:00 Shanghai boundary for month range
    // Month starts at: 1st day of month, 06:00 Shanghai = UTC (last day of prev month) 22:00
    const monthStartBusinessDate = new Date(Date.UTC(year, monthIndex, 1));
    const monthStartTs = new Date(
      monthStartBusinessDate.getTime() - 2 * 3600 * 1000,
    );
    const nextMonthStartBusinessDate = new Date(
      Date.UTC(year, monthIndex + 1, 1),
    );
    const nextMonthStartTs = new Date(
      nextMonthStartBusinessDate.getTime() - 2 * 3600 * 1000,
    );

    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestUserId,
      collectorId,
      riskControllerId,
    );
    const where: any = {
      paid_at: { gte: monthStartTs, lt: nextMonthStartTs },
      loan_account: scope.whereClause,
    };

    const rows = await this.prisma.repaymentRecord.findMany({
      where,
      select: {
        paid_amount: true,
        paid_at: true,
      },
      orderBy: { paid_at: 'asc' },
    });

    const dayMap = new Map<
      string,
      { totalPaidAmount: number; count: number }
    >();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    rows.forEach((row) => {
      // Map paid_at to the business day it belongs to:
      // paid_at + 2h gives us the "business timestamp" starting from 00:00 of the business day
      const businessTs = new Date(
        row.paid_at.getTime() + TWO_HOURS_MS - 6 * 3600 * 1000,
      );
      const date = businessTs.toISOString().slice(0, 10);
      const old = dayMap.get(date) || { totalPaidAmount: 0, count: 0 };
      old.totalPaidAmount += Number(row.paid_amount ?? 0);
      old.count += 1;
      dayMap.set(date, old);
    });

    return Array.from(dayMap.entries())
      .map(([date, value]) => ({
        date,
        totalPaidAmount: value.totalPaidAmount,
        count: value.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private getDayStart(date: Date) {
    return getBusinessDayTimestampRange(getShanghaiBusinessDate(date)).start;
  }

  private getDayEnd(date: Date) {
    const { end } = getBusinessDayTimestampRange(getShanghaiBusinessDate(date));
    return new Date(end.getTime() - 1);
  }

  private formatNumber(value: number): string {
    return Number(value || 0).toLocaleString('zh-CN');
  }

  private formatSigned(value: number): string {
    if (value >= 0) return `+${this.formatNumber(value)}`;
    return this.formatNumber(value);
  }

  /** 今日借出： -2600 + 100 -2600 + 100=5000 */
  private formatTodayLoansExpression(
    loans: { company_cost: unknown; handling_fee: unknown }[],
    total: number,
  ): string {
    if (!loans.length) {
      return `0`;
    }
    const terms: string[] = [];
    for (const loan of loans) {
      const cost = Number(loan.company_cost ?? 0);
      const fee = Number(loan.handling_fee ?? 0);
      terms.push(`-${this.formatNumber(cost)}`);
      terms.push(`+${this.formatNumber(fee)}`);
    }
    return `${terms.join('')}=${this.formatNumber(total)}`;
  }

  private formatRepaymentsWithReductionsExpression(
    repaidItems: DailyLoanBalanceItem[],
    repaidTotal: number,
    reductionItems: ReductionBalanceItem[],
    reductionTotal: number,
  ): string {
    const netTotal = repaidTotal - reductionTotal;
    const parts: string[] = [];

    for (const item of repaidItems) {
      const base = this.formatNumber(item.amount);
      const signed = item.amount >= 0 ? `+${base}` : base;
      parts.push(`${signed}${item.label || ''}`);
    }

    for (const item of reductionItems) {
      const base = this.formatNumber(Math.abs(item.amount));
      if (item.amount >= 0) {
        parts.push(`-${base}${item.label}`);
      } else {
        parts.push(`+${base}${item.label}`);
      }
    }

    if (!parts.length) {
      return `0`;
    }
    return `${parts.join('')}=${this.formatNumber(netTotal)}`;
  }

  private async buildDepositProcess(
    collectorId: number,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<DepositProcessResult> {
    const [asset, historyRows, historyFromDayStart, rcLoanRows] =
      await Promise.all([
        this.prisma.collectorAssetManagement.findUnique({
          where: { admin_id: collectorId },
          select: { deposit: true },
        }),
        // Operations strictly within this business day (for the line1 delta term)
        this.prisma.assetReductionHistory.findMany({
          where: {
            admin_id: collectorId,
            field_name: 'deposit',
            created_at: { gte: dayStart, lt: dayEnd },
          },
          select: { input_value: true },
        }),
        // All operations from dayStart onwards (to compute the pre-day start balance)
        this.prisma.assetReductionHistory.findMany({
          where: {
            admin_id: collectorId,
            field_name: 'deposit',
            created_at: { gte: dayStart },
          },
          select: { input_value: true },
        }),
        this.prisma.loanAccount.findMany({
          where: { collector_id: collectorId },
          select: {
            risk_controller_id: true,
            risk_controller: { select: { username: true } },
          },
          distinct: ['risk_controller_id'],
        }),
      ]);

    const D_current = Number(asset?.deposit ?? 0);
    const todayDelta = historyRows.reduce(
      (s, r) => s + Number(r.input_value),
      0,
    );
    // Subtract everything from dayStart onwards so startBalance reflects the
    // balance at the very beginning of this business day, regardless of how
    // many subsequent days have had operations since then.
    const deltaFromDayStart = historyFromDayStart.reduce(
      (s, r) => s + Number(r.input_value),
      0,
    );
    const startBalance = D_current - deltaFromDayStart;

    const rcBreakdown: { id: number; name: string; amount: number }[] = [];
    if (rcLoanRows.length > 0) {
      await Promise.all(
        rcLoanRows.map(async (row) => {
          const rcId = row.risk_controller_id;
          const agg = await this.prisma.repaymentRecord.aggregate({
            where: {
              loan_account: {
                collector_id: collectorId,
                risk_controller_id: rcId,
              },
              paid_at: { gte: dayStart, lt: dayEnd },
            },
            _sum: { paid_amount: true },
          });
          const amount = Number(agg._sum.paid_amount ?? 0);
          rcBreakdown.push({
            id: rcId,
            name: (row.risk_controller?.username ?? String(rcId)).charAt(0),
            amount,
          });
        }),
      );
      rcBreakdown.sort((a, b) => a.id - b.id);
    }

    const rcTotal = rcBreakdown.reduce((s, r) => s + r.amount, 0);

    const line1Expression =
      todayDelta === 0
        ? this.formatNumber(startBalance)
        : `${this.formatNumber(startBalance)}${this.formatSigned(todayDelta)}`;

    let line2Expression: string;
    if (rcBreakdown.length === 0) {
      line2Expression = `0=${this.formatNumber(0)}`;
    } else {
      const parts = rcBreakdown.map((rc, idx) => {
        const amt = this.formatNumber(rc.amount);
        if (idx === 0) return `${amt}${rc.name}`;
        return `+${amt}${rc.name}`;
      });
      line2Expression = `${parts.join('')}=${this.formatNumber(rcTotal)}`;
    }

    return {
      startBalance,
      todayDelta,
      line1Expression,
      rcBreakdown,
      line2Expression,
      rcTotal,
    };
  }

  toResponse(record: any): RepaymentRecordResponseDto {
    return {
      id: record.id,
      loan_id: record.loan_id,
      user_id: record.user_id,
      paid_amount: Number(record.paid_amount ?? 0),
      paid_at: record.paid_at,
      actual_collector_id: record.actual_collector_id || undefined,
      actual_collector_name:
        record.actual_collector?.username ||
        record.actual_collector?.nickname ||
        undefined,
      user_name: record.user?.username || undefined,
      repaid_periods: record.loan_account?.repaid_periods || 0,
      total_periods: record.loan_account?.total_periods || undefined,
      remark: record.remark || undefined,
      paid_capital: record.paid_capital != null ? Number(record.paid_capital) : undefined,
      paid_interest: record.paid_interest != null ? Number(record.paid_interest) : undefined,
      paid_fines: record.paid_fines != null ? Number(record.paid_fines) : undefined,
    };
  }
}
