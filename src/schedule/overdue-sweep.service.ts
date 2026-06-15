import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { getShanghaiBusinessTodayAndYesterday } from '../common/business-date';
import { ensureOverdueRecordsForLoan } from '../common/sync-overdue-records';

@Injectable()
export class OverdueSweepService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OverdueSweepService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Running overdue sweep on server startup');
    try {
      await this.sweepYesterdayPendingToOverdue();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown overdue sweep error';
      this.logger.error(`Overdue sweep on startup failed: ${message}`);
    }
  }

  @Cron('59 59 5 * * *', { timeZone: 'Asia/Shanghai' })
  async sweepYesterdayPendingToOverdue(): Promise<void> {
    const { yesterday } = getShanghaiBusinessTodayAndYesterday();

    const rows = await this.prisma.repaymentSchedule.findMany({
      where: {
        due_start_date: yesterday,
        status: 'pending',
      },
      select: { id: true, loan_id: true },
    });

    if (rows.length === 0) {
      this.logger.log('Overdue sweep: no pending schedules due yesterday');
      return;
    }

    const ids = rows.map((r) => r.id);
    const loanIds = [...new Set(rows.map((r) => r.loan_id))];

    let newRecordCount = 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.repaymentSchedule.updateMany({
        where: {
          id: { in: ids },
          status: 'pending',
          due_start_date: yesterday,
        },
        data: { status: 'overdue' },
      });

      for (const loanId of loanIds) {
        newRecordCount += await ensureOverdueRecordsForLoan(tx, loanId);

        const overdueCount = await tx.repaymentSchedule.count({
          where: { loan_id: loanId, status: 'overdue' },
        });
        await tx.loanAccount.update({
          where: { id: loanId },
          data: { overdue_count: overdueCount },
        });
      }
    });

    this.logger.log(
      `Overdue sweep: marked ${ids.length} schedule(s) overdue (${newRecordCount} new record(s)) for due date ${yesterday.toISOString().slice(0, 10)}`,
    );
  }
}
