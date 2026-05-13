import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RepaymentRecordResponseDto } from './dto/repayment-record-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CollectorSummaryQueryDto } from './dto/collector-summary-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';

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
      payeeId,
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
    if (payeeId) where.actual_collector_id = payeeId;
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
    const { payeeId, targetDate } = query;
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
    if (payeeId) {
      baseWhere.actual_collector_id = payeeId;
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

    return {
      monthAmount: monthRecords.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0),
      yesterdayAmount: yesterdayRecords.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0),
      todayAmount: todayRecords.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0),
      todayCount: todayRecords.length,
      totalAmount: totalRecords.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0),
    };
  }

  async getDailySummary(query: DailySummaryQueryDto, adminId: number) {
    const { payeeId, month } = query;
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
    if (payeeId) {
      where.actual_collector_id = payeeId;
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
    };
  }
}
