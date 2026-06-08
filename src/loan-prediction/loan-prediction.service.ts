import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoanAccount } from '@prisma/client';

export type LoanPredictionItem =
  | { value: number; frequency: number }
  | { value: string; frequency: number };

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

      if (fieldName === 'payer_name') {
        const allPredictions = await this.prisma.loanFieldPrediction.findMany({
          where: { field_name: 'payer_name' },
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

    if (fieldName === 'payer_name') {
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

  async recordFieldUsage(fieldName: string, value: string): Promise<void> {
    if (fieldName === 'payer_name') {
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
  }
}
