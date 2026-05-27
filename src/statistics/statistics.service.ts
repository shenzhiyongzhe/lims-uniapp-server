import { Injectable } from '@nestjs/common';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  getShanghaiBusinessDate,
  getBusinessDayTimestampRange,
} from '../common/business-date';
import {
  calcLoanAccountNetTotal,
  calcLoanDisbursementDelta,
  calcLoanDisbursementDeltaTotal,
  calcPaidAmountTotal,
} from '../common/loan-account-math';

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private getBusinessDayStart(date?: Date): Date {
    const businessDate = getShanghaiBusinessDate(date);
    return getBusinessDayTimestampRange(businessDate).start;
  }

  private getBusinessDayEnd(date?: Date): Date {
    const businessDate = getShanghaiBusinessDate(date);
    // end is exclusive (start of next business day), subtract 1ms for inclusive end
    return new Date(getBusinessDayTimestampRange(businessDate).end.getTime() - 1);
  }

  async getScopedStatistics(
    requestUserId: number,
    targetUserId?: number,
    targetDate?: Date,
  ): Promise<any> {
    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestUserId,
      targetUserId,
    );
    return this.getDetailedStatisticsByLoanScope(
      scope.isAllAccessible ? undefined : scope.loanAccountIds,
      targetDate,
      scope.isAllAccessible ? undefined : scope.scopedUserId,
    );
  }

  private async getLoanAccountIdsByUserRole(
    userId: number,
    roleType: 'collector' | 'risk_controller',
  ): Promise<number[]> {
    return this.accessScopeService.getLoanAccountIdsByUserRole(
      userId,
      roleType,
    );
  }

  private async getDetailedStatisticsByLoanScope(
    loanAccountIds: number[] | undefined,
    targetDate?: Date,
    scopedUserId?: number,
  ): Promise<any> {
    if (loanAccountIds && loanAccountIds.length === 0) {
      return this.getEmptyStatisticsWithYesterday();
    }

    const businessDate = getShanghaiBusinessDate(targetDate);
    const { start: todayStart, end: todayEnd } = getBusinessDayTimestampRange(businessDate);
    const yesterdayBusinessDate = new Date(businessDate.getTime() - 24 * 60 * 60 * 1000);
    const { start: yesterdayStart, end: yesterdayEnd } = getBusinessDayTimestampRange(yesterdayBusinessDate);

    const now = targetDate || new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const loanFilter = loanAccountIds ? { id: { in: loanAccountIds } } : {};
    const repaymentLoanFilter = loanAccountIds
      ? { loan_id: { in: loanAccountIds } }
      : {};

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

    const netPortfolioAmount = calcLoanAccountNetTotal(allLoanAccounts);

    const loansBefore = await this.prisma.loanAccount.aggregate({
      where: {
        ...loanFilter,
        due_start_date: { lt: businessDate },
      },
      _sum: {
        company_cost: true,
        handling_fee: true,
      },
    });
    const totalLentBefore = calcLoanDisbursementDelta({
      company_cost: loansBefore._sum.company_cost,
      handling_fee: loansBefore._sum.handling_fee,
    });

    const repaymentsBefore = await this.prisma.repaymentRecord.aggregate({
      where: {
        ...repaymentLoanFilter,
        paid_at: { lt: todayStart },
      },
      _sum: { paid_amount: true },
    });
    const totalRepaidBefore = calcPaidAmountTotal([
      { paid_amount: repaymentsBefore._sum.paid_amount },
    ]);

    const todayLoanRows = await this.prisma.loanAccount.findMany({
      where: {
        ...loanFilter,
        due_start_date: businessDate,
      },
      select: { company_cost: true, handling_fee: true },
    });
    const todayLoanTotal = calcLoanDisbursementDeltaTotal(todayLoanRows);

    const todayRepaymentAgg = await this.prisma.repaymentRecord.aggregate({
      where: {
        ...repaymentLoanFilter,
        paid_at: { gte: todayStart, lt: todayEnd },
      },
      _sum: { paid_amount: true },
    });
    const todayRepaidTotal = calcPaidAmountTotal([
      { paid_amount: todayRepaymentAgg._sum.paid_amount },
    ]);

    const previousTotal = totalLentBefore + totalRepaidBefore;
    const rollingTodayTotal = previousTotal + todayLoanTotal + todayRepaidTotal;

    const todayNewAmount = (
      await this.prisma.loanAccount.findMany({
        where: {
          ...loanFilter,
          due_start_date: {
            gte: businessDate,
            lt: new Date(businessDate.getTime() + 86400000),
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
            gte: businessDate,
            lt: new Date(businessDate.getTime() + 86400000),
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

    return {
      totalAmount: rollingTodayTotal,
      netPortfolioAmount,
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
      yesterdayTotalAmount: previousTotal,
    };
  }

  async getAdminStatistics(): Promise<any[]> {
    const roles = await this.prisma.loanAccountRole.findMany({
      where: { role_type: { in: ['collector', 'risk_controller'] } },
      include: { admin: { select: { id: true, nickname: true } } },
      distinct: ['admin_id', 'role_type'],
    });

    const results: any[] = [];
    for (const role of roles) {
      const loanAccountIds = await this.getLoanAccountIdsByUserRole(
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
