import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RepaymentRecordsService } from '../repayment-records/repayment-records.service';
import { getShanghaiBusinessDate } from '../common/business-date';

@Injectable()
export class DailyLoanBalanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DailyLoanBalanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repaymentRecordsService: RepaymentRecordsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Running daily loan balance snapshot on server startup');
    try {
      await this.snapshotDailyLoanBalance();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'unknown daily balance snapshot error';
      this.logger.error(
        `Daily loan balance snapshot on startup failed: ${message}`,
      );
    }
  }

  @Cron('59 59 5 * * *', { timeZone: 'Asia/Shanghai' })
  async snapshotDailyLoanBalance(): Promise<void> {
    // At 05:59:59 the business day is still "yesterday" (boundary is 06:00)
    const today = getShanghaiBusinessDate();

    const staffs = await this.prisma.staff.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (staffs.length === 0) {
      this.logger.log('Daily loan balance snapshot skipped: no staffs found');
      return;
    }

    for (const staff of staffs) {
      try {
        await this.repaymentRecordsService.upsertDailyLoanBalanceForDate(
          staff.id,
          today,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown snapshot error';
        this.logger.error(
          `Daily loan balance snapshot failed for staff ${staff.id}: ${message}`,
        );
      }
    }

    this.logger.log(
      `Daily loan balance snapshot completed for ${staffs.length} staff(s) on ${today.toISOString().slice(0, 10)}`,
    );
  }

  @Cron('0 0 2 * * *', { timeZone: 'Asia/Shanghai' }) // Run daily at 02:00
  async purgeOldDeletedLoans(): Promise<void> {
    this.logger.log('Running deleted loans recycle bin cleanup...');
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await this.prisma.deletedLoan.deleteMany({
        where: {
          deleted_at: {
            lt: thirtyDaysAgo,
          },
        },
      });
      this.logger.log(
        `Recycle bin cleanup completed: permanently deleted ${result.count} loan account(s).`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown cleanup error';
      this.logger.error(`Recycle bin cleanup failed: ${message}`);
    }
  }
}
