import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MobileTerminalService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    return parseFloat(String(value)) || 0;
  }

  async getTopStatistics() {
    const allLoanAccounts = await this.prisma.loanAccount.findMany({
      select: { handling_fee: true, receiving_amount: true, company_cost: true },
    });

    const riskControllerTotalAmount = allLoanAccounts.reduce(
      (sum, account) => sum + this.toNumber(account.handling_fee) + this.toNumber(account.receiving_amount) - this.toNumber(account.company_cost),
      0,
    );

    const allCollectorAssets = await this.prisma.collectorAssetManagement.findMany({
      select: { reduced_handling_fee: true, reduced_fines: true },
    });

    const collectorTotalReduction = allCollectorAssets.reduce(
      (sum, asset) => sum + this.toNumber(asset.reduced_handling_fee) + this.toNumber(asset.reduced_fines),
      0,
    );

    const allRiskControllerAssets = await this.prisma.riskControllerAssetManagement.findMany({
      select: { reduced_amount: true },
    });

    const riskControllerTotalReduction = allRiskControllerAssets.reduce(
      (sum, asset) => sum + this.toNumber(asset.reduced_amount),
      0,
    );

    const remainingFunds = riskControllerTotalAmount - collectorTotalReduction - riskControllerTotalReduction;

    return {
      risk_controller_total_amount: riskControllerTotalAmount,
      collector_total_reduction: collectorTotalReduction,
      remaining_funds: remainingFunds,
    };
  }

  async getPayees() {
    const collectors = await this.prisma.admin.findMany({
      where: { role: 'COLLECTOR' },
      select: { id: true, nickname: true },
    });

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const payees = await Promise.all(collectors.map(async (collector) => {
      const records = await this.prisma.repaymentRecord.findMany({
        where: { actual_collector_id: collector.id },
        select: { paid_amount: true, paid_at: true },
      });

      const today_collection = records
        .filter(r => r.paid_at >= todayStart && r.paid_at <= todayEnd)
        .reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0);

      const monthly_collection = records
        .filter(r => r.paid_at >= monthStart)
        .reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0);

      return {
        id: collector.id,
        admin_id: collector.id,
        username: collector.nickname || '未命名',
        address: '默认地址', // Mocked as no address field in Admin
        today_collection,
        monthly_collection,
        remaining_limit: 1000000, // Mocked limit
        is_disabled: false
      };
    }));

    // Calculate summary
    const summary = {
      today_total: payees.reduce((sum, p) => sum + p.today_collection, 0),
      monthly_total: payees.reduce((sum, p) => sum + p.monthly_collection, 0),
      yesterday_total: 0 // Could implement if needed
    };

    return { payees, summary };
  }
}
