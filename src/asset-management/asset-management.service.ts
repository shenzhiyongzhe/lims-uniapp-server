import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LoanAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCollectorAssetDto } from './dto/update-collector-asset.dto';
import { UpdateRiskControllerAssetDto } from './dto/update-risk-controller-asset.dto';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { QueryAssetHistoryDto } from './dto/query-asset-history.dto';

type AssetOperator = { id: number; role?: string };

type RecordHistoryParams = {
  adminId: number;
  assetType: 'collector' | 'risk_controller';
  fieldName: string;
  oldValue: number;
  inputValue: number;
  newValue: number;
  operator?: AssetOperator;
  remark?: string;
};

@Injectable()
export class AssetManagementService implements OnModuleInit {
  private readonly logger = new Logger(AssetManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  async onModuleInit() {
    this.logger.log('Asset Management Module Initialized');
  }

  async findCollectorAsset(userId: number) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: userId },
      select: { id: true, username: true, nickname: true },
    });

    const asset = await this.prisma.collectorAssetManagement.findUnique({
      where: { admin_id: userId },
    });

    const loanAccountIds =
      await this.accessScopeService.getLoanAccountIdsByUserRole(
        userId,
        'collector',
      );
    const { total_handling_fee, total_fines } =
      await this.calculateTotalAmounts(loanAccountIds);

    const reduced_handling_fee = asset
      ? Number(asset.reduced_handling_fee || 0)
      : 0;
    const reduced_fines = asset ? Number(asset.reduced_fines || 0) : 0;
    const deposit = asset ? Number(asset.deposit || 0) : 0;

    const loansAggregate = await this.prisma.loanAccount.aggregate({
      where: { collector_id: userId },
      _sum: {
        company_cost: true,
        handling_fee: true,
      },
    });
    const totalLent =
      Number(loansAggregate._sum.handling_fee || 0) -
      Number(loansAggregate._sum.company_cost || 0);

    const repaymentsAggregate = await this.prisma.repaymentRecord.aggregate({
      where: {
        loan_account: { collector_id: userId },
      },
      _sum: { paid_amount: true },
    });
    const totalRepaid = Number(repaymentsAggregate._sum.paid_amount || 0);

    const total_amount = totalLent + totalRepaid;

    return {
      id: asset?.id || 0,
      admin_id: userId,
      admin: staff,
      remaining_handling_fee: total_handling_fee - reduced_handling_fee,
      remaining_fines: total_fines - reduced_fines,
      reduced_handling_fee,
      reduced_fines,
      deposit,
      total_amount,
    };
  }

  async findAllCollectorAssets() {
    const collectors = await this.prisma.staff.findMany({
      where: { role: 'COLLECTOR' },
      select: { id: true },
    });
    return Promise.all(collectors.map((c) => this.findCollectorAsset(c.id)));
  }

  async findRiskControllerAsset(userId: number) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: userId },
      select: { id: true, username: true, nickname: true },
    });

    const asset = await this.prisma.riskControllerAssetManagement.findUnique({
      where: { admin_id: userId },
    });

    const loanAccountIds =
      await this.accessScopeService.getLoanAccountIdsByUserRole(
        userId,
        'risk_controller',
      );
    let total_amount = 0;

    if (loanAccountIds.length > 0) {
      const allLoanAccounts = await this.prisma.loanAccount.findMany({
        where: { id: { in: loanAccountIds } },
        select: {
          handling_fee: true,
          receiving_amount: true,
          company_cost: true,
        },
      });

      total_amount = allLoanAccounts.reduce(
        (sum, acc) =>
          sum +
          Number(acc.handling_fee || 0) +
          Number(acc.receiving_amount || 0) -
          Number(acc.company_cost || 0),
        0,
      );
    }

    const reduced_amount = asset ? Number(asset.reduced_amount || 0) : 0;

    return {
      id: asset?.id || 0,
      admin_id: userId,
      admin: staff,
      remaining_amount: total_amount - reduced_amount,
      reduced_amount,
    };
  }

  async findAllRiskControllerAssets() {
    const riskControllers = await this.prisma.staff.findMany({
      where: { role: 'RISK_CONTROLLER' },
      select: { id: true },
    });
    return Promise.all(
      riskControllers.map((rc) => this.findRiskControllerAsset(rc.id)),
    );
  }

  async adjustCollectorDeposit(
    userId: number,
    delta: number,
    operator?: AssetOperator,
    remark?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.collectorAssetManagement.upsert({
        where: { admin_id: userId },
        update: {},
        create: { admin_id: userId },
      });

      const oldDeposit = Number(existing.deposit || 0);
      const newDeposit = oldDeposit + delta;

      const updated = await tx.collectorAssetManagement.update({
        where: { admin_id: userId },
        data: { deposit: newDeposit },
      });

      await this.recordAssetHistory(tx, {
        adminId: userId,
        assetType: 'collector',
        fieldName: 'deposit',
        oldValue: oldDeposit,
        inputValue: delta,
        newValue: newDeposit,
        operator,
        remark,
      });

      return {
        admin_id: userId,
        deposit: Number(updated.deposit),
      };
    });
  }

  async updateCollectorAsset(
    userId: number,
    dto: UpdateCollectorAssetDto,
    operator?: AssetOperator,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.collectorAssetManagement.upsert({
        where: { admin_id: userId },
        update: {},
        create: { admin_id: userId },
      });

      const oldReducedHandling = Number(existing.reduced_handling_fee || 0);
      const oldReducedFines = Number(existing.reduced_fines || 0);

      const newReducedHandling =
        dto.reduced_handling_fee !== undefined
          ? dto.reduced_handling_fee
          : oldReducedHandling;
      const newReducedFines =
        dto.reduced_fines !== undefined ? dto.reduced_fines : oldReducedFines;

      const updated = await tx.collectorAssetManagement.update({
        where: { admin_id: userId },
        data: {
          reduced_handling_fee: newReducedHandling,
          reduced_fines: newReducedFines,
        },
      });

      if (
        dto.reduced_handling_fee !== undefined &&
        newReducedHandling !== oldReducedHandling
      ) {
        const deltaReducedHandling = newReducedHandling - oldReducedHandling;
        await this.recordAssetHistory(tx, {
          adminId: userId,
          assetType: 'collector',
          fieldName: 'reduced_handling_fee',
          oldValue: oldReducedHandling,
          inputValue: deltaReducedHandling,
          newValue: newReducedHandling,
          operator,
        });
      }

      if (
        dto.reduced_fines !== undefined &&
        newReducedFines !== oldReducedFines
      ) {
        const deltaReducedFines = newReducedFines - oldReducedFines;
        await this.recordAssetHistory(tx, {
          adminId: userId,
          assetType: 'collector',
          fieldName: 'reduced_fines',
          oldValue: oldReducedFines,
          inputValue: deltaReducedFines,
          newValue: newReducedFines,
          operator,
        });
      }

      return updated;
    });
  }

  async updateRiskControllerAsset(
    userId: number,
    dto: UpdateRiskControllerAssetDto,
    operator?: AssetOperator,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.riskControllerAssetManagement.upsert({
        where: { admin_id: userId },
        update: {},
        create: { admin_id: userId },
      });

      const oldReducedAmount = Number(existing.reduced_amount || 0);
      const newReducedAmount =
        dto.reduced_amount !== undefined
          ? dto.reduced_amount
          : oldReducedAmount;

      const updated = await tx.riskControllerAssetManagement.update({
        where: { admin_id: userId },
        data: { reduced_amount: newReducedAmount },
      });

      if (
        dto.reduced_amount !== undefined &&
        newReducedAmount !== oldReducedAmount
      ) {
        const deltaReducedAmount = newReducedAmount - oldReducedAmount;
        await this.recordAssetHistory(tx, {
          adminId: userId,
          assetType: 'risk_controller',
          fieldName: 'reduced_amount',
          oldValue: oldReducedAmount,
          inputValue: deltaReducedAmount,
          newValue: newReducedAmount,
          operator,
        });
      }

      return updated;
    });
  }

  async findAssetHistory(query: QueryAssetHistoryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AssetReductionHistoryWhereInput = {};
    if (query.adminId) {
      where.admin_id = query.adminId;
    }
    if (query.assetType) {
      where.asset_type = query.assetType;
    }

    const [data, total] = await Promise.all([
      this.prisma.assetReductionHistory.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.assetReductionHistory.count({ where }),
    ]);

    return {
      data: data.map((row) => ({
        id: row.id,
        admin_id: row.admin_id,
        asset_type: row.asset_type,
        field_name: row.field_name,
        old_value: Number(row.old_value),
        input_value: Number(row.input_value),
        new_value: Number(row.new_value),
        updated_by_admin_id: row.updated_by_admin_id,
        updated_by_admin_username: row.updated_by_admin_username,
        remark: row.remark,
        created_at: row.created_at,
      })),
      total,
      page,
      pageSize,
    };
  }

  async updateCollectorAssetFromLoanAccount(
    userId: number,
    _loanAccount: LoanAccount,
  ): Promise<void> {
    const loanAccountIds =
      await this.accessScopeService.getLoanAccountIdsByUserRole(
        userId,
        'collector',
      );
    const { total_handling_fee, total_fines } =
      await this.calculateTotalAmounts(loanAccountIds);

    await this.prisma.collectorAssetManagement.upsert({
      where: { admin_id: userId },
      update: {
        total_handling_fee,
        total_fines,
      },
      create: {
        admin_id: userId,
        total_handling_fee,
        total_fines,
      },
    });
  }

  async updateRiskControllerAssetFromLoanAccount(
    userId: number,
    _loanAccount: LoanAccount,
  ): Promise<void> {
    const loanAccountIds =
      await this.accessScopeService.getLoanAccountIdsByUserRole(
        userId,
        'risk_controller',
      );
    let total_amount = 0;

    if (loanAccountIds.length > 0) {
      const allLoanAccounts = await this.prisma.loanAccount.findMany({
        where: {
          id: { in: loanAccountIds },
        },
        select: {
          handling_fee: true,
          receiving_amount: true,
          company_cost: true,
        },
      });

      total_amount = allLoanAccounts.reduce(
        (sum, acc) =>
          sum +
          Number(acc.handling_fee || 0) +
          Number(acc.receiving_amount || 0) -
          Number(acc.company_cost || 0),
        0,
      );
    }

    await this.prisma.riskControllerAssetManagement.upsert({
      where: { admin_id: userId },
      update: { total_amount },
      create: {
        admin_id: userId,
        total_amount,
      },
    });
  }

  private async recordAssetHistory(
    tx: Prisma.TransactionClient,
    params: RecordHistoryParams,
  ) {
    let operatorUsername: string | null = null;
    if (params.operator?.id) {
      const op = await tx.staff.findUnique({
        where: { id: params.operator.id },
        select: { username: true },
      });
      operatorUsername = op?.username ?? null;
    }

    await tx.assetReductionHistory.create({
      data: {
        admin_id: params.adminId,
        asset_type: params.assetType,
        field_name: params.fieldName,
        old_value: params.oldValue,
        input_value: params.inputValue,
        new_value: params.newValue,
        updated_by_admin_id: params.operator?.id ?? null,
        updated_by_admin_username: operatorUsername,
        remark: params.remark ?? null,
      },
    });
  }

  private async calculateTotalAmounts(loanAccountIds: number[]) {
    if (loanAccountIds.length === 0)
      return { total_handling_fee: 0, total_fines: 0 };

    const accounts = await this.prisma.loanAccount.findMany({
      where: { id: { in: loanAccountIds } },
      select: { handling_fee: true, total_fines: true },
    });

    return {
      total_handling_fee: accounts.reduce(
        (sum, a) => sum + Number(a.handling_fee || 0),
        0,
      ),
      total_fines: accounts.reduce(
        (sum, a) => sum + Number(a.total_fines || 0),
        0,
      ),
    };
  }
}
