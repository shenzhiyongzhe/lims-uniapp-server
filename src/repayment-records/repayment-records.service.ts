import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RepaymentRecordResponseDto } from './dto/repayment-record-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CollectorSummaryQueryDto } from './dto/collector-summary-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';
import {
  getShanghaiYmdParts,
  utcMidnightFromYmd,
} from '../common/business-date';
import { AccessScopeService } from '../access-scope/access-scope.service';

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

type DailyLoanBalanceResult = {
  previousTotal: number;
  todayLoanTotal: number;
  todayRepaidTotal: number;
  todayTotal: number;
  todayLoanItems: DailyLoanBalanceItem[];
  todayRepaidItems: DailyLoanBalanceItem[];
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
      targetUserId,
      startDate,
      endDate,
      riskControllerId,
      collectorId,
      username,
    } = query;
    const skip = (page - 1) * pageSize;
    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestUserId,
      targetUserId,
    );

    const where: any = {};
    if (!scope.isAllAccessible) {
      where.loan_id = { in: scope.loanAccountIds };
    }
    if (userId) where.user_id = userId;
    if (loanId) {
      where.AND = [...(where.AND || []), { loan_id: loanId }];
    }
    if (riskControllerId || collectorId) {
      where.loan_account = {};
      if (riskControllerId)
        where.loan_account.risk_controller_id = riskControllerId;
      if (collectorId) where.loan_account.collector_id = collectorId;
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
    const targetUserId = query.targetUserId;
    const { targetDate } = query;
    const now = targetDate ? new Date(targetDate) : new Date();
    const dayStart = this.getDayStart(now);
    const dayEnd = this.getDayEnd(now);
    const yesterday = new Date(dayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(dayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestUserId,
      targetUserId,
    );
    const baseWhere: any = {};
    if (!scope.isAllAccessible) {
      baseWhere.loan_id = { in: scope.loanAccountIds };
    }

    const [todayRecords, yesterdayRecords, monthRecords] = await Promise.all([
      this.prisma.repaymentRecord.findMany({
        where: { ...baseWhere, paid_at: { gte: dayStart, lte: dayEnd } },
        select: { paid_amount: true, loan_id: true },
      }),
      this.prisma.repaymentRecord.findMany({
        where: { ...baseWhere, paid_at: { gte: yesterday, lte: yesterdayEnd } },
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

    const [yesterdayDailyBalance, todayDailyBalance] = await Promise.all([
      this.getDailyLoanBalance({
        requestUserId,
        targetDate: yesterday,
        targetUserId,
        persist: false,
      }),
      this.getDailyLoanBalance({
        requestUserId,
        targetDate: now,
        targetUserId,
        persist: false,
      }),
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
    };
  }

  async getDailyLoanBalance(params: {
    requestUserId: number;
    targetDate?: Date;
    targetUserId?: number;
    persist?: boolean;
  }): Promise<DailyLoanBalanceResult> {
    const {
      requestUserId,
      targetDate = new Date(),
      targetUserId,
      persist = false,
    } = params;
    const businessDate = this.getBusinessDate(targetDate);
    const dayStart = this.getDayStart(targetDate);
    const dayEnd = this.getDayEnd(targetDate);

    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestUserId,
      targetUserId,
    );
    const loanIds = scope.loanAccountIds;
    const loanIdFilter = scope.isAllAccessible ? undefined : { in: loanIds };
    const scopedBalanceUserId = scope.isAllAccessible
      ? requestUserId
      : scope.scopedUserId || requestUserId;

    const loansWhere: any = {
      ...(loanIdFilter ? { id: loanIdFilter } : {}),
      due_start_date: businessDate,
    };

    const repaymentWhere: any = {
      ...(loanIdFilter ? { loan_id: loanIdFilter } : {}),
      paid_at: { gte: dayStart, lte: dayEnd },
    };

    let previousTotal = 0;
    let previousRow: any = null;

    if (targetUserId) {
      // 交集模式下，动态算出之前的累计余额
      const loansBefore = await this.prisma.loanAccount.aggregate({
        where: {
          id: { in: loanIds },
          due_start_date: { lt: businessDate },
        },
        _sum: {
          company_cost: true,
          handling_fee: true,
        },
      });
      const totalLentBefore = -Number(loansBefore._sum.company_cost || 0) + Number(loansBefore._sum.handling_fee || 0);

      const repaymentsBefore = await this.prisma.repaymentRecord.aggregate({
        where: {
          loan_id: { in: loanIds },
          paid_at: { lt: dayStart },
        },
        _sum: {
          paid_amount: true,
        },
      });
      const totalRepaidBefore = Number(repaymentsBefore._sum.paid_amount || 0);

      previousTotal = totalLentBefore + totalRepaidBefore;
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

    const [todayLoans, todayRepayments] = await Promise.all([
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
    ]);

    const todayLoanItems: DailyLoanBalanceItem[] = todayLoans.map(
      (loan) => {
        const amount =
          -Number(loan.company_cost ?? 0) + Number(loan.handling_fee ?? 0);
        return {
          loanId: loan.id,
          amount,
          type: 'TODAY_LOAN',
          label: '借出',
          isEarlySettlement: false,
          isOverdueRepaid: false,
          remark: '',
        };
      },
    );

    const todayRepaidItems: DailyLoanBalanceItem[] = todayRepayments.map(
      (row) => {
        const remark = row.remark ?? '';
        const isEarlySettlement = remark === '提前结清';
        const isOverdue = !!row.is_overdue_repaid;
        return {
          loanId: row.loan_id,
          amount: Number(row.paid_amount ?? 0),
          type: isEarlySettlement ? 'TODAY_EARLY_SETTLEMENT' : 'TODAY_REPAY',
          label: isEarlySettlement ? '清' : (isOverdue ? '补' : ''),
          isEarlySettlement,
          isOverdueRepaid: isOverdue,
          remark,
        };
      },
    );

    const todayLoanTotal = todayLoanItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const todayRepaidTotal = todayRepaidItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const todayTotal = previousTotal + todayLoanTotal + todayRepaidTotal;

    const result: DailyLoanBalanceResult = {
      previousTotal,
      todayLoanTotal,
      todayRepaidTotal,
      todayTotal,
      todayLoanItems,
      todayRepaidItems,
      expression: {
        todayLoans: this.formatExpression(
          todayLoanItems,
          todayLoanTotal,
        ),
        todayRepayments: this.formatExpression(
          todayRepaidItems,
          todayRepaidTotal,
        ),
        summary: `${this.formatNumber(previousTotal)}${this.formatSigned(todayLoanTotal)}${this.formatSigned(todayRepaidTotal)}=${this.formatNumber(todayTotal)}`,
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
    const targetUserId = query.targetUserId;
    const { month } = query;
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const monthStart = new Date(year, monthIndex, 1);
    const nextMonthStart = new Date(year, monthIndex + 1, 1);

    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestUserId,
      targetUserId,
    );
    const where: any = {
      paid_at: { gte: monthStart, lt: nextMonthStart },
    };
    if (!scope.isAllAccessible) {
      where.loan_id = { in: scope.loanAccountIds };
    }

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
    rows.forEach((row) => {
      const date = row.paid_at.toISOString().slice(0, 10);
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
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getDayEnd(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private getBusinessDate(date: Date) {
    const { y, m, d } = getShanghaiYmdParts(date);
    return utcMidnightFromYmd(y, m, d);
  }

  private formatNumber(value: number): string {
    return Number(value || 0).toLocaleString('zh-CN');
  }

  private formatSigned(value: number): string {
    if (value >= 0) return `+${this.formatNumber(value)}`;
    return this.formatNumber(value);
  }

  private formatExpression(
    items: DailyLoanBalanceItem[],
    total: number,
  ): string {
    if (!items.length) {
      return `0=${this.formatNumber(total)}`;
    }
    const parts = items.map((item, idx) => {
      const base = this.formatNumber(item.amount);
      if (idx === 0) return item.isEarlySettlement ? `${base}(清)` : base;
      const signed = item.amount >= 0 ? `+${base}` : base;
      return item.isEarlySettlement ? `${signed}(清)` : signed;
    });
    return `${parts.join('')}=${this.formatNumber(total)}`;
  }

  toResponse(record: any): RepaymentRecordResponseDto {
    return {
      id: record.id,
      loan_id: record.loan_id,
      user_id: record.user_id,
      paid_amount: Number(record.paid_amount ?? 0),
      paid_at: record.paid_at,
      actual_collector_id: record.actual_collector_id || undefined,
      actual_collector_name: record.actual_collector?.nickname || undefined,
      user_name: record.user?.username || undefined,
      repaid_periods: record.loan_account?.repaid_periods || 0,
      total_periods: record.loan_account?.total_periods || undefined,
      remark: record.remark || undefined,
    };
  }
}
