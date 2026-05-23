import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LoanAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCollectorAssetDto } from './dto/update-collector-asset.dto';
import { UpdateRiskControllerAssetDto } from './dto/update-risk-controller-asset.dto';
import { AccessScopeService } from '../access-scope/access-scope.service';

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
    const admin = await this.prisma.admin.findUnique({
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

    return {
      id: asset?.id || 0,
      admin_id: userId,
      admin,
      remaining_handling_fee: total_handling_fee - reduced_handling_fee,
      remaining_fines: total_fines - reduced_fines,
      reduced_handling_fee,
      reduced_fines,
    };
  }

  async findAllCollectorAssets() {
    const collectors = await this.prisma.admin.findMany({
      where: { role: 'COLLECTOR' },
      select: { id: true },
    });
    return Promise.all(collectors.map((c) => this.findCollectorAsset(c.id)));
  }

  async findRiskControllerAsset(userId: number) {
    const admin = await this.prisma.admin.findUnique({
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
      admin,
      remaining_amount: total_amount - reduced_amount,
      reduced_amount,
    };
  }

  async findAllRiskControllerAssets() {
    const riskControllers = await this.prisma.admin.findMany({
      where: { role: 'RISK_CONTROLLER' },
      select: { id: true },
    });
    return Promise.all(
      riskControllers.map((rc) => this.findRiskControllerAsset(rc.id)),
    );
  }

  async updateCollectorAsset(userId: number, dto: UpdateCollectorAssetDto) {
    await this.prisma.collectorAssetManagement.upsert({
      where: { admin_id: userId },
      update: {},
      create: { admin_id: userId },
    });

    return this.prisma.collectorAssetManagement.update({
      where: { admin_id: userId },
      data: {
        reduced_handling_fee: dto.reduced_handling_fee,
        reduced_fines: dto.reduced_fines,
      },
    });
  }

  async updateRiskControllerAsset(
    userId: number,
    dto: UpdateRiskControllerAssetDto,
  ) {
    await this.prisma.riskControllerAssetManagement.upsert({
      where: { admin_id: userId },
      update: {},
      create: { admin_id: userId },
    });

    return this.prisma.riskControllerAssetManagement.update({
      where: { admin_id: userId },
      data: {
        reduced_amount: dto.reduced_amount,
      },
    });
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
