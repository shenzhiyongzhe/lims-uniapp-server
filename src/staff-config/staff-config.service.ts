import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY,
  normalizePinnedLoanIds,
  type PinnedLoanIdsValue,
} from './staff-config.constants';

@Injectable()
export class StaffConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(staffId: number, key: string) {
    const row = await this.prisma.staffConfig.findUnique({
      where: { staff_id_key: { staff_id: staffId, key } },
    });
    if (!row) {
      return { key, value: this.defaultValueForKey(key) };
    }
    return { key: row.key, value: row.value };
  }

  async upsertConfig(
    staffId: number,
    key: string,
    value: Record<string, unknown>,
  ) {
    const normalized = this.normalizeValueForKey(key, value);
    const row = await this.prisma.staffConfig.upsert({
      where: { staff_id_key: { staff_id: staffId, key } },
      create: {
        staff_id: staffId,
        key,
        value: normalized as Prisma.InputJsonValue,
      },
      update: {
        value: normalized as Prisma.InputJsonValue,
      },
    });
    return { key: row.key, value: row.value };
  }

  async getPinnedLoanIds(staffId: number): Promise<number[]> {
    const { value } = await this.getConfig(
      staffId,
      LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY,
    );
    return normalizePinnedLoanIds(value);
  }

  async pinLoan(staffId: number, loanId: number) {
    if (!Number.isInteger(loanId) || loanId <= 0) {
      throw new BadRequestException('loanId 无效');
    }
    const current = await this.getPinnedLoanIds(staffId);
    const next = [loanId, ...current.filter((id) => id !== loanId)];
    return this.upsertConfig(staffId, LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY, {
      loanIds: next,
    });
  }

  async unpinLoan(staffId: number, loanId: number) {
    if (!Number.isInteger(loanId) || loanId <= 0) {
      throw new BadRequestException('loanId 无效');
    }
    const current = await this.getPinnedLoanIds(staffId);
    const next = current.filter((id) => id !== loanId);
    return this.upsertConfig(staffId, LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY, {
      loanIds: next,
    });
  }

  private defaultValueForKey(key: string): PinnedLoanIdsValue | Record<string, never> {
    if (key === LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY) {
      return { loanIds: [] };
    }
    return {};
  }

  private normalizeValueForKey(
    key: string,
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    if (key === LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY) {
      return { loanIds: normalizePinnedLoanIds(value) };
    }
    return value;
  }
}
