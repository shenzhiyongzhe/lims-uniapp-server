import { Injectable } from '@nestjs/common';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private getBusinessDayStart(date?: Date): Date {
    const d = date ? new Date(date) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getBusinessDayEnd(date?: Date): Date {
    const d = date ? new Date(date) : new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }

  async getScopedStatistics(
    requestAdminId: number,
    targetAdminId?: number,
    targetDate?: Date,
  ): Promise<any> {
    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestAdminId,
      targetAdminId,
    );
    return this.getDetailedStatisticsByLoanScope(
      scope.isAllAccessible ? undefined : scope.loanAccountIds,
      targetDate,
      scope.isAllAccessible ? undefined : scope.scopedAdminId,
    );
  }

  private async getLoanAccountIdsByAdminRole(
    adminId: number,
    roleType: 'collector' | 'risk_controller',
  ): Promise<number[]> {
    return this.accessScopeService.getLoanAccountIdsByAdminRole(
      adminId,
      roleType,
    );
  }

  private async getDetailedStatisticsByLoanScope(
    loanAccountIds: number[] | undefined,
    targetDate?: Date,
    scopedAdminId?: number,
    includeYesterdayTotal: boolean = true,
  ): Promise<any> {
    if (loanAccountIds && loanAccountIds.length === 0) {
      return this.getEmptyStatisticsWithYesterday();
    }

    const todayStart = this.getBusinessDayStart(targetDate);
    const todayEnd = this.getBusinessDayEnd(targetDate);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const now = targetDate || new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const loanFilter = loanAccountIds ? { id: { in: loanAccountIds } } : {};

    const allLoanAccounts = await this.prisma.loanAccount.findMany({
      where: loanFilter,
      select: {
        loan_amount: true,
        handling_fee: true,
        total_fines: true,
        receiving_amount: true,
        company_cost: true,
      },
    });

    const totalAmount = allLoanAccounts.reduce(
      (sum, acc) =>
        sum +
        Number(acc.handling_fee || 0) +
        Number(acc.receiving_amount || 0) -
        Number(acc.company_cost || 0),
      0,
    );

    const todayNewAmount = (
      await this.prisma.loanAccount.findMany({
        where: {
          ...loanFilter,
          due_start_date: {
            gte: todayStart,
            lt: new Date(todayStart.getTime() + 86400000),
          },
        },
        select: { loan_amount: true },
      })
    ).reduce((sum, acc) => sum + Number(acc.loan_amount), 0);

    const todaySettledAmount = (
      await this.prisma.loanAccount.findMany({
        where: {
          ...loanFilter,
          status: 'settled',
          due_end_date: {
            gte: todayStart,
            lt: new Date(todayStart.getTime() + 86400000),
          },
        },
        select: { loan_amount: true },
      })
    ).reduce((sum, acc) => sum + Number(acc.loan_amount), 0);

    const thisMonthNewAccounts = await this.prisma.loanAccount.findMany({
      where: {
        ...loanFilter,
        due_start_date: { gte: thisMonthStart, lt: nextMonthStart },
      },
      select: { loan_amount: true },
    });
    const thisMonthNewAmount = thisMonthNewAccounts.reduce(
      (sum, acc) => sum + Number(acc.loan_amount),
      0,
    );

    const thisMonthSettledAccounts = await this.prisma.loanAccount.findMany({
      where: {
        ...loanFilter,
        status: 'settled',
        due_end_date: { gte: thisMonthStart, lt: nextMonthStart },
      },
      select: { loan_amount: true },
    });
    const thisMonthSettledAmount = thisMonthSettledAccounts.reduce(
      (sum, acc) => sum + Number(acc.loan_amount),
      0,
    );

    const thisMonthAccounts = await this.prisma.loanAccount.findMany({
      where: {
        ...loanFilter,
        due_start_date: { gte: thisMonthStart, lt: nextMonthStart },
      },
      select: { handling_fee: true, total_fines: true },
    });
    const thisMonthHandlingFee = thisMonthAccounts.reduce(
      (sum, acc) => sum + Number(acc.handling_fee),
      0,
    );
    const thisMonthFines = thisMonthAccounts.reduce(
      (sum, acc) => sum + Number(acc.total_fines),
      0,
    );

    const thisMonthNegotiatedCount = await this.prisma.loanAccount.count({
      where: {
        ...loanFilter,
        status: 'negotiated',
        status_changed_at: { gte: thisMonthStart, lt: nextMonthStart },
      },
    });

    const thisMonthBlacklistCount = await this.prisma.loanAccount.count({
      where: {
        ...loanFilter,
        status: 'blacklist',
        status_changed_at: { gte: thisMonthStart, lt: nextMonthStart },
      },
    });

    const lastMonthStart = new Date(thisMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthAccounts = await this.prisma.loanAccount.findMany({
      where: {
        ...loanFilter,
        due_start_date: { gte: lastMonthStart, lt: thisMonthStart },
      },
      select: { handling_fee: true, total_fines: true },
    });
    const lastMonthHandlingFee = lastMonthAccounts.reduce(
      (sum, acc) => sum + Number(acc.handling_fee),
      0,
    );
    const lastMonthFines = lastMonthAccounts.reduce(
      (sum, acc) => sum + Number(acc.total_fines),
      0,
    );

    const lastMonthNegotiatedCount = await this.prisma.loanAccount.count({
      where: {
        ...loanFilter,
        status: 'negotiated',
        status_changed_at: { gte: lastMonthStart, lt: thisMonthStart },
      },
    });

    const lastMonthBlacklistCount = await this.prisma.loanAccount.count({
      where: {
        ...loanFilter,
        status: 'blacklist',
        status_changed_at: { gte: lastMonthStart, lt: thisMonthStart },
      },
    });

    const lastMonthNewCount = await this.prisma.loanAccount.count({
      where: {
        ...loanFilter,
        created_at: { gte: lastMonthStart, lt: thisMonthStart },
      },
    });

    const lastMonthSettledCount = await this.prisma.loanAccount.count({
      where: {
        ...loanFilter,
        status: 'settled',
        status_changed_at: { gte: lastMonthStart, lt: thisMonthStart },
      },
    });

    const result = {
      totalAmount,
      todayNewAmount,
      todaySettledAmount,
      thisMonthNewAmount,
      thisMonthSettledAmount,
      thisMonthHandlingFee,
      thisMonthFines,
      thisMonthNegotiatedCount,
      thisMonthBlacklistCount,
      lastMonthHandlingFee,
      lastMonthFines,
      lastMonthNegotiatedCount,
      lastMonthBlacklistCount,
      lastMonthNewCount,
      lastMonthSettledCount,
      yesterdayTotalAmount: 0,
    };

    if (includeYesterdayTotal) {
      const yesterdayDateForDb = new Date(
        yesterdayStart.toISOString().split('T')[0] + 'T12:00:00.000Z',
      );
      const yesterdayStats = await this.prisma.dailyStatistics.aggregate({
        where: {
          date: yesterdayDateForDb,
          ...(scopedAdminId ? { admin_id: scopedAdminId } : {}),
        },
        _sum: { total_amount: true },
      });
      result.yesterdayTotalAmount = Number(
        yesterdayStats._sum.total_amount || 0,
      );
    }

    return result;
  }

  async getAdminStatistics(): Promise<any[]> {
    const roles = await this.prisma.loanAccountRole.findMany({
      where: { role_type: { in: ['collector', 'risk_controller'] } },
      include: { admin: { select: { id: true, nickname: true } } },
      distinct: ['admin_id', 'role_type'],
    });

    const results: any[] = [];
    for (const role of roles) {
      const loanAccountIds = await this.getLoanAccountIdsByAdminRole(
        role.admin_id,
        role.role_type as 'collector' | 'risk_controller',
      );
      const statistics = await this.getDetailedStatisticsByLoanScope(
        loanAccountIds,
        undefined,
        role.admin_id,
      );
      results.push({
        admin_id: role.admin_id,
        admin_name:
          role.role_type === 'collector'
            ? role.admin.nickname || ''
            : role.admin.nickname || '',
        role: role.role_type,
        ...statistics,
      });
    }
    return results;
  }

  private getEmptyStatistics() {
    return {
      totalAmount: 0,
      todayNewAmount: 0,
      todaySettledAmount: 0,
      thisMonthNewAmount: 0,
      thisMonthSettledAmount: 0,
      thisMonthHandlingFee: 0,
      thisMonthFines: 0,
      thisMonthNegotiatedCount: 0,
      thisMonthBlacklistCount: 0,
      lastMonthHandlingFee: 0,
      lastMonthFines: 0,
      lastMonthNegotiatedCount: 0,
      lastMonthBlacklistCount: 0,
      lastMonthNewCount: 0,
      lastMonthSettledCount: 0,
    };
  }

  private getEmptyStatisticsWithYesterday() {
    return {
      ...this.getEmptyStatistics(),
      yesterdayTotalAmount: 0,
    };
  }
}
