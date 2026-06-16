import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LoanAccount, Prisma, ReductionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCollectorAssetDto } from './dto/update-collector-asset.dto';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { QueryAssetHistoryDto } from './dto/query-asset-history.dto';
import { CreateReductionRecordDto } from './dto/create-reduction-record.dto';
import { QueryReductionRecordsDto } from './dto/query-reduction-records.dto';
import { QueryReductionDailySummaryDto } from './dto/query-reduction-daily-summary.dto';
import {
  QueryReductionCounterpartySummaryDto,
  ReductionPerspective,
} from './dto/query-reduction-counterparty-summary.dto';
import { QueryDepositDailySummaryDto } from './dto/query-deposit-daily-summary.dto';
import { QueryDepositRecordsDto } from './dto/query-deposit-records.dto';
import {
  getBusinessDayTimestampRange,
  utcMidnightFromYmd,
} from '../common/business-date';

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

  // ─── 聚合查询减资明细的辅助方法 ────────────────────────────────────────

  /** 查询指定 collector 被减资的各类型汇总 */
  private async getCollectorReductions(collectorId: number) {
    const rows = await this.prisma.riskControllerReductionRecord.groupBy({
      by: ['reduction_type'],
      where: { collector_id: collectorId },
      _sum: { amount: true },
    });
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.reduction_type] = Number(row._sum.amount ?? 0);
    }
    return {
      reduced_fines: map['fines'] ?? 0,
      reduced_handling_fee: map['handling_fee'] ?? 0,
      reduced_by_risk_controller:
        (map['fines'] ?? 0) + (map['handling_fee'] ?? 0) + (map['amount'] ?? 0),
    };
  }

  /** 查询指定 risk_controller 减资的总金额 */
  private async getRiskControllerReductions(riskControllerId: number) {
    const result = await this.prisma.riskControllerReductionRecord.aggregate({
      where: { risk_controller_id: riskControllerId },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  // ─── Collector 资产 ────────────────────────────────────────────────────

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

    const deposit = asset ? Number(asset.deposit || 0) : 0;

    // 从明细表聚合
    const { reduced_fines, reduced_handling_fee, reduced_by_risk_controller } =
      await this.getCollectorReductions(userId);

    const transferAggregate = await this.prisma.assetReductionHistory.aggregate({
      where: {
        admin_id: userId,
        asset_type: 'collector',
        field_name: 'transfer',
      },
      _sum: {
        input_value: true,
      },
    });
    const transfer_amount = Number(transferAggregate._sum.input_value || 0);

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

    const reduction_by_counterparty = (
      await this.findReductionCounterpartySummary({
        perspective: ReductionPerspective.collector,
        adminId: userId,
      })
    ).filter((item) => item.totalAmount > 0);

    return {
      id: asset?.id || 0,
      admin_id: userId,
      admin: staff,
      remaining_handling_fee: total_handling_fee - reduced_handling_fee,
      remaining_fines: total_fines - reduced_fines,
      reduced_handling_fee,
      reduced_fines,
      deposit,
      reduced_by_risk_controller,
      total_amount,
      total_received: totalRepaid,
      reduction_by_counterparty,
      transfer_amount,
    };
  }

  async findAllCollectorAssets() {
    const collectors = await this.prisma.staff.findMany({
      where: { role: 'COLLECTOR' },
      select: { id: true },
    });
    return Promise.all(collectors.map((c) => this.findCollectorAsset(c.id)));
  }

  // ─── Risk Controller 资产 ──────────────────────────────────────────────

  async findRiskControllerAsset(userId: number) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: userId },
      select: { id: true, username: true, nickname: true },
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

    // 从明细表聚合
    const reduced_amount = await this.getRiskControllerReductions(userId);

    // 查询该风控人对各 collector 的减资汇总（二维透视）
    const reductionByCollector = await this.prisma.riskControllerReductionRecord.groupBy({
      by: ['collector_id', 'reduction_type'],
      where: { risk_controller_id: userId },
      _sum: { amount: true },
    });

    const reduction_by_counterparty = (
      await this.findReductionCounterpartySummary({
        perspective: ReductionPerspective.risk_controller,
        adminId: userId,
      })
    ).filter((item) => item.totalAmount > 0);

    return {
      id: 0,
      admin_id: userId,
      admin: staff,
      remaining_amount: total_amount - reduced_amount,
      reduced_amount,
      reduction_by_collector: reductionByCollector.map((r) => ({
        collector_id: r.collector_id,
        reduction_type: r.reduction_type,
        amount: Number(r._sum.amount ?? 0),
      })),
      reduction_by_counterparty,
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

  // ─── 减资明细操作 ──────────────────────────────────────────────────────

  /** 创建一条减资明细记录（risk_controller → collector） */
  async createReductionRecord(
    riskControllerId: number,
    dto: CreateReductionRecordDto,
    operator?: AssetOperator,
  ) {
    return this.prisma.riskControllerReductionRecord.create({
      data: {
        risk_controller_id: riskControllerId,
        collector_id: dto.collector_id,
        reduction_type: dto.reduction_type as ReductionType,
        amount: dto.amount,
        remark: dto.remark ?? null,
        created_by: operator?.id ?? null,
      },
      include: {
        risk_controller: { select: { id: true, username: true } },
        collector: { select: { id: true, username: true } },
        operator: { select: { id: true, username: true } },
      },
    });
  }

  private getMonthTimestampRange(month: string) {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const monthStartBusinessDate = new Date(Date.UTC(year, monthIndex, 1));
    const monthStartTs = new Date(
      monthStartBusinessDate.getTime() - 2 * 3600 * 1000,
    );
    const nextMonthStartBusinessDate = new Date(
      Date.UTC(year, monthIndex + 1, 1),
    );
    const nextMonthStartTs = new Date(
      nextMonthStartBusinessDate.getTime() - 2 * 3600 * 1000,
    );
    return { monthStartTs, nextMonthStartTs };
  }

  private aggregateRowsToDailySummary(
    rows: Array<{ amount: number; created_at: Date }>,
  ) {
    const dayMap = new Map<
      string,
      { totalPaidAmount: number; count: number }
    >();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    rows.forEach((row) => {
      const businessTs = new Date(
        row.created_at.getTime() + TWO_HOURS_MS,
      );
      const date = businessTs.toISOString().slice(0, 10);
      const old = dayMap.get(date) || { totalPaidAmount: 0, count: 0 };
      old.totalPaidAmount += row.amount;
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

  private buildReductionRecordWhere(
    query: Pick<
      QueryReductionRecordsDto,
      'riskControllerId' | 'collectorId' | 'reductionType' | 'date'
    >,
  ): Prisma.RiskControllerReductionRecordWhereInput {
    const where: Prisma.RiskControllerReductionRecordWhereInput = {};
    if (query.riskControllerId) {
      where.risk_controller_id = query.riskControllerId;
    }
    if (query.collectorId) {
      where.collector_id = query.collectorId;
    }
    if (query.reductionType) {
      where.reduction_type = query.reductionType as ReductionType;
    }
    if (query.date) {
      const [yearStr, monthStr, dayStr] = query.date.split('-');
      const businessDate = utcMidnightFromYmd(
        Number(yearStr),
        Number(monthStr),
        Number(dayStr),
      );
      const { start, end } = getBusinessDayTimestampRange(businessDate);
      where.created_at = { gte: start, lt: end };
    }
    return where;
  }

  /** 关联人员汇总（下拉列表：负责人↔风控人） */
  async findReductionCounterpartySummary(
    query: QueryReductionCounterpartySummaryDto,
  ) {
    const { perspective, adminId, reductionType } = query;
    const where: Prisma.RiskControllerReductionRecordWhereInput =
      perspective === ReductionPerspective.collector
        ? { collector_id: adminId }
        : { risk_controller_id: adminId };

    const rows = await this.prisma.riskControllerReductionRecord.groupBy({
      by:
        perspective === ReductionPerspective.collector
          ? ['risk_controller_id', 'reduction_type']
          : ['collector_id', 'reduction_type'],
      where,
      _sum: { amount: true },
    });

    const counterpartyMap = new Map<
      number | null,
      { amountByType: Record<string, number> }
    >();

    for (const row of rows) {
      const counterpartyId =
        perspective === ReductionPerspective.collector
          ? row.risk_controller_id
          : row.collector_id;
      const entry = counterpartyMap.get(counterpartyId) || {
        amountByType: {},
      };
      const typeKey = row.reduction_type;
      entry.amountByType[typeKey] =
        (entry.amountByType[typeKey] ?? 0) + Number(row._sum.amount ?? 0);
      counterpartyMap.set(counterpartyId, entry);
    }

    const counterpartyIds = Array.from(counterpartyMap.keys()).filter(id => id !== null && id !== undefined);
    if (counterpartyIds.length === 0) {
      return [];
    }

    const staffs = await this.prisma.staff.findMany({
      where: { id: { in: counterpartyIds } },
      select: { id: true, username: true, nickname: true, role: true },
    });
    const staffMap = new Map(staffs.map((s) => [s.id, s]));

    const result = counterpartyIds
      .map((id) => {
        const staff = staffMap.get(id);
        const amountByType = counterpartyMap.get(id)?.amountByType ?? {};
        const totalAmount = reductionType
          ? Number(amountByType[reductionType] ?? 0)
          : Object.values(amountByType).reduce((sum, v) => sum + v, 0);
        return {
          id,
          username: staff?.username || staff?.nickname || `ID ${id}`,
          role: staff?.role || null,
          totalAmount,
          amountByType,
        };
      })
      .filter((item) => item.totalAmount > 0 || !reductionType)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return result;
  }

  /** 按业务日汇总减资金额（日历展示） */
  async findReductionDailySummary(query: QueryReductionDailySummaryDto) {
    const { month, riskControllerId, collectorId, reductionType } = query;
    const { monthStartTs, nextMonthStartTs } =
      this.getMonthTimestampRange(month);

    const where: Prisma.RiskControllerReductionRecordWhereInput = {
      created_at: { gte: monthStartTs, lt: nextMonthStartTs },
    };
    if (riskControllerId) {
      where.risk_controller_id = riskControllerId;
    }
    if (collectorId) {
      where.collector_id = collectorId;
    }
    if (reductionType) {
      where.reduction_type = reductionType;
    }

    const rows = await this.prisma.riskControllerReductionRecord.findMany({
      where,
      select: {
        amount: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return this.aggregateRowsToDailySummary(
      rows.map((row) => ({
        amount: Number(row.amount ?? 0),
        created_at: row.created_at,
      })),
    );
  }

  /** 查询减资明细（支持 risk_controller_id、collector_id、type、date 过滤 + 分页） */
  async findReductionRecords(query: QueryReductionRecordsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where = this.buildReductionRecordWhere(query);

    const [data, total] = await Promise.all([
      this.prisma.riskControllerReductionRecord.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        include: {
          risk_controller: { select: { id: true, username: true, nickname: true } },
          collector: { select: { id: true, username: true, nickname: true } },
          operator: { select: { id: true, username: true } },
        },
      }),
      this.prisma.riskControllerReductionRecord.count({ where }),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id,
        risk_controller_id: r.risk_controller_id,
        risk_controller: r.risk_controller,
        collector_id: r.collector_id,
        collector: r.collector,
        reduction_type: r.reduction_type,
        amount: Number(r.amount),
        remark: r.remark,
        created_by: r.created_by,
        operator: r.operator,
        created_at: r.created_at,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 存出款按日汇总（日历展示） */
  async findDepositDailySummary(
    userId: number,
    query: QueryDepositDailySummaryDto,
  ) {
    const { monthStartTs, nextMonthStartTs } = this.getMonthTimestampRange(
      query.month,
    );

    const rows = await this.prisma.assetReductionHistory.findMany({
      where: {
        admin_id: userId,
        asset_type: 'collector',
        field_name: { in: ['deposit', 'transfer'] },
        created_at: { gte: monthStartTs, lt: nextMonthStartTs },
      },
      select: {
        input_value: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return this.aggregateRowsToDailySummary(
      rows.map((row) => ({
        amount: Math.abs(Number(row.input_value ?? 0)),
        created_at: row.created_at,
      })),
    );
  }

  /** 存出款明细 */
  async findDepositRecords(userId: number, query: QueryDepositRecordsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AssetReductionHistoryWhereInput = {
      admin_id: userId,
      asset_type: 'collector',
      field_name: { in: ['deposit', 'transfer'] },
    };

    if (query.date) {
      const [yearStr, monthStr, dayStr] = query.date.split('-');
      const businessDate = utcMidnightFromYmd(
        Number(yearStr),
        Number(monthStr),
        Number(dayStr),
      );
      const { start, end } = getBusinessDayTimestampRange(businessDate);
      where.created_at = { gte: start, lt: end };
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
        field_name: row.field_name,
        input_value: Number(row.input_value),
        old_value: Number(row.old_value),
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

  // ─── Collector deposit 调整 ─────────────────────────────────────────────

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

  async transferCollectorDeposit(
    userId: number,
    amount: number,
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
      const newDeposit = oldDeposit - amount;

      const updated = await tx.collectorAssetManagement.update({
        where: { admin_id: userId },
        data: { deposit: newDeposit },
      });

      await this.recordAssetHistory(tx, {
        adminId: userId,
        assetType: 'collector',
        fieldName: 'transfer',
        oldValue: oldDeposit,
        inputValue: amount,
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

  /** 保留接口签名兼容性，实际只允许调整 deposit */
  async updateCollectorAsset(
    userId: number,
    dto: UpdateCollectorAssetDto,
    operator?: AssetOperator,
  ) {
    if (dto.deposit !== undefined) {
      return this.adjustCollectorDeposit(userId, dto.deposit, operator);
    }
    return this.prisma.collectorAssetManagement.findUnique({
      where: { admin_id: userId },
    });
  }

  // ─── 历史记录查询 ───────────────────────────────────────────────────────

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

  // ─── 内部触发：贷款账户变更时同步资产表汇总 ─────────────────────────────

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
    // No-op since RiskControllerAssetManagement table is deleted
  }

  // ─── 私有工具 ───────────────────────────────────────────────────────────

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
