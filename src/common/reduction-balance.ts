import { Prisma, PrismaClient, ReductionType } from '@prisma/client';

type ReductionPrisma = Pick<PrismaClient, 'riskControllerReductionRecord'>;

export type ReductionBalanceItem = {
  id: number;
  amount: number;
  reduction_type: ReductionType;
  label: string;
};

const REDUCTION_TYPE_LABELS: Record<ReductionType, string> = {
  fines: '罚金',
  handling_fee: '后扣',
  amount: '本金',
};

export const formatReductionTypeLabel = (type: ReductionType): string =>
  REDUCTION_TYPE_LABELS[type] ?? type;

export const buildReductionWhereFromLoanScope = (
  loanAccountWhere: Record<string, unknown>,
): Prisma.RiskControllerReductionRecordWhereInput => {
  if (loanAccountWhere.id === -1) {
    return { id: -1 };
  }

  const where: Prisma.RiskControllerReductionRecordWhereInput = {};
  if (loanAccountWhere.collector_id != null) {
    where.collector_id = Number(loanAccountWhere.collector_id);
  }
  if (loanAccountWhere.risk_controller_id != null) {
    where.risk_controller_id = Number(loanAccountWhere.risk_controller_id);
  }
  return where;
};

type ReductionTimeRange = {
  lt?: Date;
  gte?: Date;
};

const buildTimeWhere = (
  timeRange?: ReductionTimeRange,
): Prisma.DateTimeFilter | undefined => {
  if (!timeRange) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (timeRange.lt) filter.lt = timeRange.lt;
  if (timeRange.gte) filter.gte = timeRange.gte;
  return Object.keys(filter).length > 0 ? filter : undefined;
};

export const sumReductionAmount = async (
  prisma: ReductionPrisma,
  where: Prisma.RiskControllerReductionRecordWhereInput,
  timeRange?: ReductionTimeRange,
): Promise<number> => {
  const createdAt = buildTimeWhere(timeRange);
  const result = await prisma.riskControllerReductionRecord.aggregate({
    where: {
      ...where,
      ...(createdAt ? { created_at: createdAt } : {}),
    },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
};

export const findReductionItems = async (
  prisma: ReductionPrisma,
  where: Prisma.RiskControllerReductionRecordWhereInput,
  dayStart: Date,
  dayEnd: Date,
): Promise<ReductionBalanceItem[]> => {
  const rows = await prisma.riskControllerReductionRecord.findMany({
    where: {
      ...where,
      created_at: { gte: dayStart, lt: dayEnd },
    },
    select: {
      id: true,
      amount: true,
      reduction_type: true,
    },
    orderBy: { created_at: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount ?? 0),
    reduction_type: row.reduction_type,
    label: formatReductionTypeLabel(row.reduction_type),
  }));
};
