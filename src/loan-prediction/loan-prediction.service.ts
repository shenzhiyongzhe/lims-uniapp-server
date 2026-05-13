import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoanAccount } from '@prisma/client';

@Injectable()
export class LoanPredictionService {
  constructor(private readonly prisma: PrismaService) {}

  // 获取预测数据
  async getPredictions(
    fieldName: string,
    prefix?: string,
  ): Promise<Array<{ value: number; frequency: number }>> {
    if (prefix && prefix.trim() !== '') {
      // 如果有前缀，查询以该前缀开头的记录
      if (fieldName === 'to_hand_ratio') {
        // to_hand_ratio特殊处理：将小数转为百分数进行匹配
        const allPredictions = await this.prisma.loanFieldPrediction.findMany({
          where: { field_name: fieldName },
          orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
        });

        // 过滤：将value转为百分数字符串，检查是否以prefix开头
        const filtered = allPredictions
          .filter((p) => {
            const percentValue = String(Number(p.value) * 100);
            return percentValue.startsWith(prefix);
          })
          .slice(0, 3);

        return filtered.map((p) => ({
          value: Number(p.value),
          frequency: p.frequency,
        }));
      } else {
        // 其他字段：直接字符串匹配
        const allPredictions = await this.prisma.loanFieldPrediction.findMany({
          where: { field_name: fieldName },
          orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
        });

        // 过滤：将value转为字符串，检查是否以prefix开头
        const filtered = allPredictions
          .filter((p) => {
            const valueStr = String(Number(p.value));
            return valueStr.startsWith(prefix);
          })
          .slice(0, 3);

        return filtered.map((p) => ({
          value: Number(p.value),
          frequency: p.frequency,
        }));
      }
    } else {
      // 如果没有前缀，返回频次最高的3条
      const predictions = await this.prisma.loanFieldPrediction.findMany({
        where: { field_name: fieldName },
        orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
        take: 3,
      });

      return predictions.map((p) => ({
        value: Number(p.value),
        frequency: p.frequency,
      }));
    }
  }

  // 更新预测数据
  async recordFieldUsage(fieldName: string, value: string): Promise<void> {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) return;

    await this.prisma.loanFieldPrediction.upsert({
      where: {
        field_name_value: {
          field_name: fieldName,
          value: numValue,
        },
      },
      update: {
        frequency: { increment: 1 },
        last_used_at: new Date(),
      },
      create: {
        field_name: fieldName,
        value: numValue,
        frequency: 1,
        last_used_at: new Date(),
      },
    });
  }

  async updatePredictions(loanAccount: LoanAccount): Promise<void> {
    const fieldsToUpdate = [
      { name: 'loan_amount', value: loanAccount.loan_amount },
      { name: 'to_hand_ratio', value: loanAccount.to_hand_ratio },
      { name: 'capital', value: loanAccount.capital },
      { name: 'interest', value: loanAccount.interest },
      { name: 'company_cost', value: loanAccount.company_cost },
      { name: 'handling_fee', value: loanAccount.handling_fee },
    ];

    await Promise.all(
      fieldsToUpdate.map(async (field) => {
        if (field.value === null || field.value === undefined) return;
        await this.recordFieldUsage(field.name, field.value.toString());
      }),
    );
  }
}
