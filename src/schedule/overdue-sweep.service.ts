import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { getShanghaiBusinessTodayAndYesterday } from '../common/business-date';

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

  @Cron('0 6 * * *', { timeZone: 'Asia/Shanghai' })
  async sweepYesterdayPendingToOverdue(): Promise<void> {
    const { yesterday } = getShanghaiBusinessTodayAndYesterday();

    const rows = await this.prisma.repaymentSchedule.findMany({
      where: {
        due_start_date: yesterday,
        status: 'pending',
      },
      include: {
        loan_account: {
          select: {
            id: true,
            user_id: true,
            collector: { select: { nickname: true } },
          },
        },
      },
    });

    if (rows.length === 0) {
      this.logger.log('Overdue sweep: no pending schedules due yesterday');
      return;
    }

    const ids = rows.map((r) => r.id);

    const existingOverdueRecords = await this.prisma.overdueRecord.findMany({
      where: { schedule_id: { in: ids } },
      select: { schedule_id: true },
    });
    const scheduleIdsWithRecord = new Set(
      existingOverdueRecords.map((r) => r.schedule_id),
    );
    const rowsNeedNewRecord = rows.filter((r) => !scheduleIdsWithRecord.has(r.id));

    await this.prisma.$transaction(async (tx) => {
      await tx.repaymentSchedule.updateMany({
        where: {
          id: { in: ids },
          status: 'pending',
          due_start_date: yesterday,
        },
        data: { status: 'overdue' },
      });

      if (rowsNeedNewRecord.length === 0) {
        this.logger.log(
          `Overdue sweep: ${ids.length} schedule(s) updated; all already had overdue records`,
        );
      } else {
        const collectorLabel = (nickname: string | null | undefined) => {
          const s = (nickname ?? '').trim();
          return s.length > 0 ? s.slice(0, 10) : '-';
        };

        await tx.overdueRecord.createMany({
          data: rowsNeedNewRecord.map((row) => ({
            user_id: row.loan_account.user_id,
            loan_id: row.loan_id,
            schedule_id: row.id,
            collector: collectorLabel(row.loan_account.collector?.nickname),
            overdue_date: yesterday,
          })),
          skipDuplicates: true,
        });
      }

      const userDeltas = new Map<number, number>();
      for (const row of rowsNeedNewRecord) {
        const uid = row.loan_account.user_id;
        userDeltas.set(uid, (userDeltas.get(uid) ?? 0) + 1);
      }
      for (const [userId, n] of userDeltas) {
        await tx.user.update({
          where: { id: userId },
          data: { overdue_time: { increment: n } },
        });
      }

      const loanIds = [...new Set(rows.map((r) => r.loan_id))];
      for (const loanId of loanIds) {
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
      `Overdue sweep: marked ${ids.length} schedule(s) overdue (${rowsNeedNewRecord.length} new record(s)) for due date ${yesterday.toISOString().slice(0, 10)}`,
    );
  }
}
