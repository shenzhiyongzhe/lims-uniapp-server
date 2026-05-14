import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RepaymentRecordResponseDto } from './dto/repayment-record-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CollectorSummaryQueryDto } from './dto/collector-summary-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';
import { getShanghaiYmdParts, utcMidnightFromYmd } from '../common/business-date';

type DailyLoanBalanceItemType =
  | 'YESTERDAY_DUE_LOAN'
  | 'TODAY_REPAY'
  | 'TODAY_EARLY_SETTLEMENT';

type DailyLoanBalanceItem = {
  loanId: number;
  amount: number;
  type: DailyLoanBalanceItemType;
  label: string;
  isEarlySettlement: boolean;
  remark: string;
};

type DailyLoanBalanceResult = {
  previousTotal: number;
  yesterdayLoanTotal: number;
  todayRepaidTotal: number;
  todayTotal: number;
  yesterdayLoanItems: DailyLoanBalanceItem[];
  todayRepaidItems: DailyLoanBalanceItem[];
  expression: {
    yesterdayLoans: string;
    todayRepayments: string;
    summary: string;
  };
  date: string;
  adminId: number;
};

@Injectable()
export class RepaymentRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllWithPagination(
    query: PaginationQueryDto,
    adminId: number,
  ): Promise<any> {
    const {
      page = 1,
      pageSize = 20,
      userId,
      loanId,
      adminId: scopeCollectorAdminId,
      startDate,
      endDate,
      riskControllerId,
      collectorId,
      username,
    } = query;
    const skip = (page - 1) * pageSize;
    const loanIds = await this.getScopedLoanIds(adminId, riskControllerId, collectorId);

    let where: any = { loan_id: { in: loanIds } };
    if (userId) where.user_id = userId;
    if (loanId) where.loan_id = loanId;
    if (scopeCollectorAdminId)
      where.actual_collector_id = scopeCollectorAdminId;
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

  async getCollectorSummary(query: CollectorSummaryQueryDto, adminId: number) {
    const { adminId: scopeCollectorAdminId, targetDate } = query;
    const now = targetDate ? new Date(targetDate) : new Date();
    const dayStart = this.getDayStart(now);
    const dayEnd = this.getDayEnd(now);
    const yesterday = new Date(dayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(dayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const loanIds = await this.getScopedLoanIds(adminId);
    const baseWhere: any = { loan_id: { in: loanIds } };
    if (scopeCollectorAdminId) {
      baseWhere.actual_collector_id = scopeCollectorAdminId;
    }

    const [todayRecords, yesterdayRecords, monthRecords, totalRecords] = await Promise.all([
      this.prisma.repaymentRecord.findMany({
        where: { ...baseWhere, paid_at: { gte: dayStart, lte: dayEnd } },
        select: { paid_amount: true },
      }),
      this.prisma.repaymentRecord.findMany({
        where: { ...baseWhere, paid_at: { gte: yesterday, lte: yesterdayEnd } },
        select: { paid_amount: true },
      }),
      this.prisma.repaymentRecord.findMany({
        where: { ...baseWhere, paid_at: { gte: monthStart, lt: nextMonthStart } },
        select: { paid_amount: true },
      }),
      this.prisma.repaymentRecord.findMany({
        where: baseWhere,
        select: { paid_amount: true },
      }),
    ]);

    const dailyLoanBalance = await this.getDailyLoanBalance({
      adminId,
      targetDate: now,
      scopeCollectorAdminId,
      persist: false,
    });

    return {
      monthAmount: monthRecords.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0),
      yesterdayAmount: yesterdayRecords.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0),
      todayAmount: todayRecords.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0),
      todayCount: todayRecords.length,
      totalAmount: totalRecords.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0),
      dailyLoanBalance,
    };
  }

  async getDailyLoanBalance(params: {
    adminId: number;
    targetDate?: Date;
    scopeCollectorAdminId?: number;
    persist?: boolean;
  }): Promise<DailyLoanBalanceResult> {
    const {
      adminId,
      targetDate = new Date(),
      scopeCollectorAdminId,
      persist = false,
    } = params;
    const businessDate = this.getBusinessDate(targetDate);
    const yesterdayDate = new Date(businessDate);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);

    const dayStart = this.getDayStart(targetDate);
    const dayEnd = this.getDayEnd(targetDate);

    const loanIds = await this.getScopedLoanIds(adminId);
    const loansWhere: any = {
      id: { in: loanIds },
      due_start_date: yesterdayDate,
    };
    if (scopeCollectorAdminId) {
      loansWhere.collector_id = scopeCollectorAdminId;
    }

    const repaymentWhere: any = {
      loan_id: { in: loanIds },
      paid_at: { gte: dayStart, lte: dayEnd },
    };
    if (scopeCollectorAdminId) {
      repaymentWhere.actual_collector_id = scopeCollectorAdminId;
    }

    const [yesterdayLoans, todayRepayments, previousRow] = await Promise.all([
      this.prisma.loanAccount.findMany({
        where: loansWhere,
        select: {
          id: true,
          company_cost: true,
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
        },
        orderBy: { paid_at: 'asc' },
      }),
      this.prisma.collectorDailyLoanBalance.findFirst({
        where: {
          admin_id: adminId,
          date: { lt: businessDate },
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    const yesterdayLoanItems: DailyLoanBalanceItem[] = yesterdayLoans.map((loan) => {
      const amount = -Number(loan.company_cost ?? 0);
      return {
        loanId: loan.id,
        amount,
        type: 'YESTERDAY_DUE_LOAN',
        label: '借出',
        isEarlySettlement: false,
        remark: '',
      };
    });

    const todayRepaidItems: DailyLoanBalanceItem[] = todayRepayments.map((row) => {
      const remark = row.remark ?? '';
      const isEarlySettlement = remark === '提前结清';
      return {
        loanId: row.loan_id,
        amount: Number(row.paid_amount ?? 0),
        type: isEarlySettlement ? 'TODAY_EARLY_SETTLEMENT' : 'TODAY_REPAY',
        label: isEarlySettlement ? '清' : '',
        isEarlySettlement,
        remark,
      };
    });

    const previousTotal = Number(previousRow?.today_total ?? 0);
    const yesterdayLoanTotal = yesterdayLoanItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const todayRepaidTotal = todayRepaidItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const todayTotal = previousTotal + yesterdayLoanTotal + todayRepaidTotal;

    const result: DailyLoanBalanceResult = {
      previousTotal,
      yesterdayLoanTotal,
      todayRepaidTotal,
      todayTotal,
      yesterdayLoanItems,
      todayRepaidItems,
      expression: {
        yesterdayLoans: this.formatExpression(yesterdayLoanItems, yesterdayLoanTotal),
        todayRepayments: this.formatExpression(todayRepaidItems, todayRepaidTotal),
        summary: `${this.formatNumber(previousTotal)}${this.formatSigned(yesterdayLoanTotal)}${this.formatSigned(todayRepaidTotal)}=${this.formatNumber(todayTotal)}`,
      },
      date: businessDate.toISOString().slice(0, 10),
      adminId,
    };

    if (persist) {
      await this.prisma.collectorDailyLoanBalance.upsert({
        where: {
          admin_id_date: {
            admin_id: adminId,
            date: businessDate,
          },
        },
        update: {
          previous_total: previousTotal,
          yesterday_loan_total: yesterdayLoanTotal,
          today_repaid_total: todayRepaidTotal,
          today_total: todayTotal,
          yesterday_loan_items: result.yesterdayLoanItems as any,
          today_repaid_items: result.todayRepaidItems as any,
        },
        create: {
          admin_id: adminId,
          date: businessDate,
          previous_total: previousTotal,
          yesterday_loan_total: yesterdayLoanTotal,
          today_repaid_total: todayRepaidTotal,
          today_total: todayTotal,
          yesterday_loan_items: result.yesterdayLoanItems as any,
          today_repaid_items: result.todayRepaidItems as any,
        },
      });
    }

    return result;
  }

  async upsertDailyLoanBalanceForDate(
    adminId: number,
    targetDate: Date,
  ): Promise<DailyLoanBalanceResult> {
    return this.getDailyLoanBalance({
      adminId,
      targetDate,
      persist: true,
    });
  }

  async getDailySummary(query: DailySummaryQueryDto, adminId: number) {
    const { adminId: scopeCollectorAdminId, month } = query;
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const monthStart = new Date(year, monthIndex, 1);
    const nextMonthStart = new Date(year, monthIndex + 1, 1);

    const loanIds = await this.getScopedLoanIds(adminId);
    const where: any = {
      loan_id: { in: loanIds },
      paid_at: { gte: monthStart, lt: nextMonthStart },
    };
    if (scopeCollectorAdminId) {
      where.actual_collector_id = scopeCollectorAdminId;
    }

    const rows = await this.prisma.repaymentRecord.findMany({
      where,
      select: {
        paid_amount: true,
        paid_at: true,
      },
      orderBy: { paid_at: 'asc' },
    });

    const dayMap = new Map<string, { totalPaidAmount: number; count: number }>();
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

  private async getScopedLoanIds(
    adminId: number,
    riskControllerId?: number,
    collectorId?: number,
  ): Promise<number[]> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, role: true },
    });

    if (!admin) throw new Error('管理员不存在');

    const loanAccountWhere: any = {};
    if (admin.role === 'RISK_CONTROLLER') {
      loanAccountWhere.risk_controller_id = admin.id;
      if (collectorId) loanAccountWhere.collector_id = collectorId;
    } else if (admin.role === 'COLLECTOR') {
      loanAccountWhere.collector_id = admin.id;
      if (riskControllerId) loanAccountWhere.risk_controller_id = riskControllerId;
    }

    const loanAccount = await this.prisma.loanAccount.findMany({
      where: loanAccountWhere,
      select: { id: true },
    });

    return loanAccount.map((la) => la.id);
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

  private formatExpression(items: DailyLoanBalanceItem[], total: number): string {
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
