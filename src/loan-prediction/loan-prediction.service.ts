import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoanAccount } from '@prisma/client';

export type LoanPredictionItem =
  | { value: number; frequency: number }
  | { value: string; frequency: number };

export const PREDICTION_FIELDS = [
  'loan_amount',
  'to_hand_ratio',
  'company_cost',
  'period_capital',
  'period_interest',
  'handling_fee',
  'ownership',
  'payer_name',
] as const;

const TEXT_PREDICTION_FIELDS = new Set(['payer_name', 'ownership']);

function mapRowToPredictionItem(
  fieldName: string,
  row: { value: string; frequency: number },
): LoanPredictionItem {
  if (TEXT_PREDICTION_FIELDS.has(fieldName)) {
    return { value: row.value, frequency: row.frequency };
  }
  return { value: Number(row.value), frequency: row.frequency };
}

/** 非 payer_name 字段：入库用的规范化数字串；因为现在字段全为整型，所以存整数字符串 */
function storageValueForNumericField(
  fieldName: string,
  raw: string,
): string | null {
  const numValue = Math.round(Number(raw));
  if (Number.isNaN(numValue) || numValue <= 0) return null;
  if (fieldName === 'to_hand_ratio') {
    if (numValue > 100) return null;
  }
  return String(numValue);
}

@Injectable()
export class LoanPredictionService {
  constructor(private readonly prisma: PrismaService) {}

  async getPredictions(
    fieldName: string,
    prefix?: string,
  ): Promise<LoanPredictionItem[]> {
    const pref = (prefix ?? '').trim();

    if (pref) {
      if (fieldName === 'payer_name' || fieldName === 'ownership') {
        const allPredictions = await this.prisma.loanFieldPrediction.findMany({
          where: { field_name: fieldName },
          orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
        });
        const filtered = allPredictions
          .filter((p) => p.value.startsWith(pref))
          .slice(0, 3);
        return filtered.map((p) => ({
          value: p.value,
          frequency: p.frequency,
        }));
      }

      const allPredictions = await this.prisma.loanFieldPrediction.findMany({
        where: { field_name: fieldName },
        orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
      });

      const filtered = allPredictions
        .filter((p) => {
          const valueStr = String(Number(p.value));
          return valueStr.startsWith(pref);
        })
        .slice(0, 3);

      return filtered.map((p) => ({
        value: Number(p.value),
        frequency: p.frequency,
      }));
    }

    const predictions = await this.prisma.loanFieldPrediction.findMany({
      where: { field_name: fieldName },
      orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
      take: 3,
    });

    if (fieldName === 'payer_name' || fieldName === 'ownership') {
      return predictions.map((p) => ({
        value: p.value,
        frequency: p.frequency,
      }));
    }

    return predictions.map((p) => ({
      value: Number(p.value),
      frequency: p.frequency,
    }));
  }

  async getAllPredictions(): Promise<Record<string, LoanPredictionItem[]>> {
    const rows = await this.prisma.loanFieldPrediction.findMany({
      where: { field_name: { in: [...PREDICTION_FIELDS] } },
      orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
    });

    const grouped: Record<string, LoanPredictionItem[]> = {};
    for (const field of PREDICTION_FIELDS) {
      grouped[field] = [];
    }

    for (const row of rows) {
      const list = grouped[row.field_name];
      if (!list || list.length >= 3) continue;
      list.push(mapRowToPredictionItem(row.field_name, row));
    }

    return grouped;
  }

  async recordFieldUsage(fieldName: string, value: string): Promise<void> {
    if (fieldName === 'payer_name' || fieldName === 'ownership') {
      const t = value.trim();
      if (!t || t.length > 50) return;
      await this.prisma.loanFieldPrediction.upsert({
        where: {
          field_name_value: {
            field_name: fieldName,
            value: t,
          },
        },
        update: {
          frequency: { increment: 1 },
          last_used_at: new Date(),
        },
        create: {
          field_name: fieldName,
          value: t,
          frequency: 1,
          last_used_at: new Date(),
        },
      });
      return;
    }

    const stored = storageValueForNumericField(fieldName, value);
    if (!stored) return;

    await this.prisma.loanFieldPrediction.upsert({
      where: {
        field_name_value: {
          field_name: fieldName,
          value: stored,
        },
      },
      update: {
        frequency: { increment: 1 },
        last_used_at: new Date(),
      },
      create: {
        field_name: fieldName,
        value: stored,
        frequency: 1,
        last_used_at: new Date(),
      },
    });
  }

  async updatePredictions(loanAccount: LoanAccount): Promise<void> {
    const fieldsToUpdate = [
      { name: 'loan_amount', value: loanAccount.loan_amount },
      { name: 'to_hand_ratio', value: loanAccount.to_hand_ratio },
      { name: 'period_capital', value: loanAccount.period_capital },
      { name: 'period_interest', value: loanAccount.period_interest },
      { name: 'company_cost', value: loanAccount.company_cost },
      { name: 'handling_fee', value: loanAccount.handling_fee },
    ];

    await Promise.all(
      fieldsToUpdate.map(async (field) => {
        if (field.value === null || field.value === undefined) return;
        await this.recordFieldUsage(field.name, field.value.toString());
      }),
    );

    const payer = loanAccount.payer_name?.trim();
    if (payer) {
      await this.recordFieldUsage('payer_name', payer);
    }

    const ownership = loanAccount.ownership?.trim();
    if (ownership) {
      await this.recordFieldUsage('ownership', ownership);
    }
  }
}
