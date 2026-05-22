import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type LoanAccountHandlingFeeAndFines = Prisma.LoanAccountGetPayload<{
  select: { handling_fee: true; total_fines: true };
}>;
type LoanAccountAmount = Prisma.LoanAccountGetPayload<{
  select: { loan_amount: true };
}>;

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getCollectorDetailedStatisticsForAdmin(
    adminId: number,
    roleType: 'collector' | 'risk_controller',
    targetDate?: Date,
    selectedAdminId?: number,
  ): Promise<any> {
    if (selectedAdminId) {
      return this.getCollectorDetailedStatisticsInternal(
        selectedAdminId,
        roleType,
        targetDate,
        true,
      );
    }

    if (roleType === 'collector') {
      return this.getAllCollectorsStatisticsSum(targetDate);
    } else {
      return this.getAllRiskControllersStatisticsSum(targetDate);
    }
  }

  private async getAllCollectorsStatisticsSum(targetDate?: Date): Promise<any> {
    const roles = await this.prisma.loanAccountRole.findMany({
      where: { role_type: 'collector' },
      select: { admin_id: true },
      distinct: ['admin_id'],
    });

    const ids = roles.map((r) => r.admin_id);
    if (ids.length === 0) return this.getEmptyStatistics();

    const allStats = await Promise.all(
      ids.map((id) =>
        this.getCollectorDetailedStatisticsInternal(id, 'collector', targetDate, true),
      ),
    );

    return this.sumStatistics(allStats);
  }

  private async getAllRiskControllersStatisticsSum(targetDate?: Date): Promise<any> {
    const roles = await this.prisma.loanAccountRole.findMany({
      where: { role_type: 'risk_controller' },
      select: { admin_id: true },
      distinct: ['admin_id'],
    });

    const ids = roles.map((r) => r.admin_id);
    if (ids.length === 0) return this.getEmptyStatistics();

    const allStats = await Promise.all(
      ids.map((id) =>
        this.getCollectorDetailedStatisticsInternal(id, 'risk_controller', targetDate, true),
      ),
    );

    return this.sumStatistics(allStats);
  }

  private sumStatistics(allStats: any[]): any {
    return allStats.reduce(
      (acc, stats) => {
        for (const key in acc) {
          acc[key] += Number(stats[key] || 0);
        }
        return acc;
      },
      this.getEmptyStatisticsWithYesterday(),
    );
  }

  private getEmptyStatisticsWithYesterday() {
    return {
      ...this.getEmptyStatistics(),
      yesterdayTotalAmount: 0,
    };
  }

  async getCollectorDetailedStatisticsForCollector(
    adminId: number,
    roleType: 'collector' | 'risk_controller',
    targetDate?: Date,
    riskControllerId?: number,
    collectorId?: number,
  ): Promise<any> {
    return this.getCollectorDetailedStatisticsInternal(
      adminId,
      roleType,
      targetDate,
      true,
      riskControllerId,
      collectorId,
    );
  }

  private async getCollectorDetailedStatisticsInternal(
    adminId: number,
    roleType: 'collector' | 'risk_controller',
    targetDate?: Date,
    includeYesterdayTotal: boolean = false,
    riskControllerId?: number,
    collectorId?: number,
  ): Promise<any> {
    let roles = await this.prisma.loanAccountRole.findMany({
      where: { admin_id: adminId, role_type: roleType },
      select: { loan_account_id: true },
    });

    let loanAccountIds = roles.map((r) => r.loan_account_id);

    if (riskControllerId && roleType === 'collector') {
      const filtered = await this.prisma.loanAccountRole.findMany({
        where: { admin_id: riskControllerId, role_type: 'risk_controller', loan_account_id: { in: loanAccountIds } },
        select: { loan_account_id: true },
      });
      loanAccountIds = filtered.map((r) => r.loan_account_id);
    } else if (collectorId && roleType === 'risk_controller') {
      const filtered = await this.prisma.loanAccountRole.findMany({
        where: { admin_id: collectorId, role_type: 'collector', loan_account_id: { in: loanAccountIds } },
        select: { loan_account_id: true },
      });
      loanAccountIds = filtered.map((r) => r.loan_account_id);
    }

    if (loanAccountIds.length === 0) return this.getEmptyStatisticsWithYesterday();

    const todayStart = this.getBusinessDayStart(targetDate);
    const todayEnd = this.getBusinessDayEnd(targetDate);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const now = targetDate || new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const allLoanAccounts = await this.prisma.loanAccount.findMany({
      where: { id: { in: loanAccountIds } },
      select: {
        loan_amount: true,
        handling_fee: true,
        total_fines: true,
        receiving_amount: true,
        company_cost: true,
      },
    });

    const totalAmount = allLoanAccounts.reduce((sum, acc) => sum + Number(acc.handling_fee || 0) + Number(acc.receiving_amount || 0) - Number(acc.company_cost || 0), 0);

    const todayNewAmount = (await this.prisma.loanAccount.findMany({
      where: { id: { in: loanAccountIds }, due_start_date: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) } },
      select: { loan_amount: true },
    })).reduce((sum, acc) => sum + Number(acc.loan_amount), 0);

    const todaySettledAmount = (await this.prisma.loanAccount.findMany({
      where: { id: { in: loanAccountIds }, status: 'settled', due_end_date: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) } },
      select: { loan_amount: true },
    })).reduce((sum, acc) => sum + Number(acc.loan_amount), 0);

    const thisMonthNewAccounts: LoanAccountAmount[] = await this.prisma.loanAccount.findMany({
      where: { id: { in: loanAccountIds }, due_start_date: { gte: thisMonthStart, lt: nextMonthStart } },
      select: { loan_amount: true },
    });
    const thisMonthNewAmount = thisMonthNewAccounts.reduce((sum, acc) => sum + Number(acc.loan_amount), 0);

    const thisMonthSettledAccounts: LoanAccountAmount[] = await this.prisma.loanAccount.findMany({
      where: { id: { in: loanAccountIds }, status: 'settled', due_end_date: { gte: thisMonthStart, lt: nextMonthStart } },
      select: { loan_amount: true },
    });
    const thisMonthSettledAmount = thisMonthSettledAccounts.reduce((sum, acc) => sum + Number(acc.loan_amount), 0);

    const thisMonthAccounts: LoanAccountHandlingFeeAndFines[] =
      await this.prisma.loanAccount.findMany({
      where: { id: { in: loanAccountIds }, due_start_date: { gte: thisMonthStart, lt: nextMonthStart } },
      select: { handling_fee: true, total_fines: true },
    });
    const thisMonthHandlingFee = thisMonthAccounts.reduce((sum, acc) => sum + Number(acc.handling_fee), 0);
    const thisMonthFines = thisMonthAccounts.reduce((sum, acc) => sum + Number(acc.total_fines), 0);

    const thisMonthNegotiatedCount = await this.prisma.loanAccount.count({
      where: { id: { in: loanAccountIds }, status: 'negotiated', status_changed_at: { gte: thisMonthStart, lt: nextMonthStart } },
    });

    const thisMonthBlacklistCount = await this.prisma.loanAccount.count({
      where: { id: { in: loanAccountIds }, status: 'blacklist', status_changed_at: { gte: thisMonthStart, lt: nextMonthStart } },
    });

    const lastMonthStart = new Date(thisMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthAccounts: LoanAccountHandlingFeeAndFines[] =
      await this.prisma.loanAccount.findMany({
      where: { id: { in: loanAccountIds }, due_start_date: { gte: lastMonthStart, lt: thisMonthStart } },
      select: { handling_fee: true, total_fines: true },
    });
    const lastMonthHandlingFee = lastMonthAccounts.reduce((sum, acc) => sum + Number(acc.handling_fee), 0);
    const lastMonthFines = lastMonthAccounts.reduce((sum, acc) => sum + Number(acc.total_fines), 0);

    const lastMonthBlacklistCount = await this.prisma.loanAccount.count({
      where: { id: { in: loanAccountIds }, status: 'blacklist', status_changed_at: { gte: lastMonthStart, lt: thisMonthStart } },
    });

    const lastMonthNewCount = await this.prisma.loanAccount.count({
      where: { id: { in: loanAccountIds }, created_at: { gte: lastMonthStart, lt: thisMonthStart } },
    });

    const lastMonthSettledCount = await this.prisma.loanAccount.count({
      where: { id: { in: loanAccountIds }, status: 'settled', status_changed_at: { gte: lastMonthStart, lt: thisMonthStart } },
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
      lastMonthBlacklistCount,
      lastMonthNewCount,
      lastMonthSettledCount,
      yesterdayTotalAmount: 0
    };

    if (includeYesterdayTotal) {
      const yesterdayDateForDb = new Date(yesterdayStart.toISOString().split('T')[0] + 'T12:00:00.000Z');
      const yesterdayStats = await this.prisma.dailyStatistics.findUnique({
        where: { admin_id_date_role: { admin_id: adminId, date: yesterdayDateForDb, role: roleType } },
        select: { total_amount: true },
      });
      result.yesterdayTotalAmount = yesterdayStats ? Number(yesterdayStats.total_amount) : 0;
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
      const statistics = await this.getCollectorDetailedStatisticsForAdmin(role.admin_id, role.role_type as any);
      results.push({
        admin_id: role.admin_id,
        admin_name: role.role_type === 'collector' ? (role.admin.nickname || '') : (role.admin.nickname || ''),
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
      lastMonthBlacklistCount: 0,
      lastMonthNewCount: 0,
      lastMonthSettledCount: 0,
    };
  }
}
