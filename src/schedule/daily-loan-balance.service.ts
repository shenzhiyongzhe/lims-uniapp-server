import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RepaymentRecordsService } from '../repayment-records/repayment-records.service';
import { getShanghaiBusinessTodayAndYesterday } from '../common/business-date';

@Injectable()
export class DailyLoanBalanceService {
  private readonly logger = new Logger(DailyLoanBalanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repaymentRecordsService: RepaymentRecordsService,
  ) {}

  @Cron('59 59 23 * * *', { timeZone: 'Asia/Shanghai' })
  async snapshotDailyLoanBalance(): Promise<void> {
    const { today } = getShanghaiBusinessTodayAndYesterday();

    const admins = await this.prisma.admin.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (admins.length === 0) {
      this.logger.log('Daily loan balance snapshot skipped: no admins found');
      return;
    }

    for (const admin of admins) {
      try {
        await this.repaymentRecordsService.upsertDailyLoanBalanceForDate(
          admin.id,
          today,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown snapshot error';
        this.logger.error(
          `Daily loan balance snapshot failed for admin ${admin.id}: ${message}`,
        );
      }
    }

    this.logger.log(
      `Daily loan balance snapshot completed for ${admins.length} admin(s) on ${today.toISOString().slice(0, 10)}`,
    );
  }
}
