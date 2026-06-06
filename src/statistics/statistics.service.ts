import { Injectable } from '@nestjs/common';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  getShanghaiBusinessDate,
  getBusinessDayTimestampRange,
  getShanghaiYmdParts,
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
    return new Date(
      getBusinessDayTimestampRange(businessDate).end.getTime() - 1,
    );
  }

  async getScopedStatistics(
    requestUserId: number,
    collectorId?: number,
    riskControllerId?: number,
    targetDate?: Date,
  ): Promise<any> {
    const scope = await this.accessScopeService.resolveLoanAccountScope(
      requestUserId,
      collectorId,
      riskControllerId,
    );
    return this.getDetailedStatisticsByLoanScope(
      scope.whereClause,
      targetDate,
    );
  }

  private async getDetailedStatisticsByLoanScope(
    loanAccountWhere: any,
    targetDate?: Date,
  ): Promise<any> {
    const businessDate = getShanghaiBusinessDate(targetDate);
    const { start: todayStart, end: todayEnd } =
      getBusinessDayTimestampRange(businessDate);

    const now = targetDate || new Date();
    const shanghaiParts = getShanghaiYmdParts(now);
    const thisMonthStart = new Date(
      Date.UTC(shanghaiParts.y, shanghaiParts.m - 1, 1) - 2 * 3600 * 1000,
    );
    const nextMonthStart = new Date(
      Date.UTC(shanghaiParts.y, shanghaiParts.m, 1) - 2 * 3600 * 1000,
    );

    let lastMonthY = shanghaiParts.y;
    let lastMonthM = shanghaiParts.m - 1;
    if (lastMonthM === 0) {
      lastMonthM = 12;
      lastMonthY -= 1;
    }
    const lastMonthStart = new Date(
      Date.UTC(lastMonthY, lastMonthM - 1, 1) - 2 * 3600 * 1000,
    );
    const loanFilter = loanAccountWhere;
    const repaymentLoanFilter = {
      loan_account: loanAccountWhere,
    };

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
        created_at: { lt: todayStart },
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
        created_at: { gte: todayStart, lt: todayEnd },
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
          created_at: {
            gte: todayStart,
            lt: todayEnd,
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
          status_changed_at: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
        select: { loan_amount: true },
      })
    ).reduce((sum, acc) => sum + Number(acc.loan_amount), 0);

    const thisMonthNewAccounts = await this.prisma.loanAccount.findMany({
      where: {
        ...loanFilter,
        created_at: { gte: thisMonthStart, lt: nextMonthStart },
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
        status_changed_at: { gte: thisMonthStart, lt: nextMonthStart },
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
        created_at: { gte: thisMonthStart, lt: nextMonthStart },
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

    const lastMonthAccounts = await this.prisma.loanAccount.findMany({
      where: {
        ...loanFilter,
        created_at: { gte: lastMonthStart, lt: thisMonthStart },
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
    const collectors = await this.prisma.staff.findMany({
      where: {
        loanAccountsAsCollector: { some: {} },
      },
      select: { id: true, nickname: true },
    });

    const riskControllers = await this.prisma.staff.findMany({
      where: {
        loanAccountsAsRiskController: { some: {} },
      },
      select: { id: true, nickname: true },
    });

    const results: any[] = [];

    for (const c of collectors) {
      const statistics = (await this.getDetailedStatisticsByLoanScope(
        { collector_id: c.id },
        undefined,
      )) as Record<string, unknown>;
      results.push({
        admin_id: c.id,
        admin_name: c.nickname || '',
        role: 'collector',
        ...statistics,
      });
    }

    for (const rc of riskControllers) {
      const statistics = (await this.getDetailedStatisticsByLoanScope(
        { risk_controller_id: rc.id },
        undefined,
      )) as Record<string, unknown>;
      results.push({
        admin_id: rc.id,
        admin_name: rc.nickname || '',
        role: 'risk_controller',
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
