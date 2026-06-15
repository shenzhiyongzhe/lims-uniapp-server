import { Prisma } from '@prisma/client';

export function collectorLabel(nickname: string | null | undefined): string {
  const s = (nickname ?? '').trim();
  return s.length > 0 ? s.slice(0, 10) : '-';
}

async function decrementUserOverdueTime(
  tx: Prisma.TransactionClient,
  userId: number,
  count: number,
): Promise<void> {
  if (count <= 0) {
    return;
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { overdue_time: true },
  });
  const current = user?.overdue_time ?? 0;
  const next = Math.max(0, current - count);

  await tx.user.update({
    where: { id: userId },
    data: { overdue_time: next },
  });
}

/**
 * Remove OverdueRecord rows for schedules on a loan that are no longer overdue,
 * and decrement user.overdue_time accordingly.
 */
export async function removeStaleOverdueRecordsForLoan(
  tx: Prisma.TransactionClient,
  loanId: number,
): Promise<number> {
  const loan = await tx.loanAccount.findUnique({
    where: { id: loanId },
    select: { user_id: true },
  });

  if (!loan) {
    return 0;
  }

  const staleRecords = await tx.overdueRecord.findMany({
    where: {
      loan_id: loanId,
      schedule: { status: { not: 'overdue' } },
    },
    select: { id: true },
  });

  if (staleRecords.length === 0) {
    return 0;
  }

  await tx.overdueRecord.deleteMany({
    where: { id: { in: staleRecords.map((r) => r.id) } },
  });

  await decrementUserOverdueTime(tx, loan.user_id, staleRecords.length);

  return staleRecords.length;
}

/**
 * Remove OverdueRecord rows for specific schedules (e.g. before schedule delete),
 * and decrement user.overdue_time accordingly.
 */
export async function removeOverdueRecordsForSchedules(
  tx: Prisma.TransactionClient,
  userId: number,
  scheduleIds: number[],
): Promise<number> {
  if (scheduleIds.length === 0) {
    return 0;
  }

  const records = await tx.overdueRecord.findMany({
    where: { schedule_id: { in: scheduleIds } },
    select: { id: true },
  });

  if (records.length === 0) {
    return 0;
  }

  await tx.overdueRecord.deleteMany({
    where: { id: { in: records.map((r) => r.id) } },
  });

  await decrementUserOverdueTime(tx, userId, records.length);

  return records.length;
}

/**
 * For overdue schedules on a loan, create missing OverdueRecord rows and
 * increment user.overdue_time. Idempotent when records already exist.
 */
export async function ensureOverdueRecordsForLoan(
  tx: Prisma.TransactionClient,
  loanId: number,
): Promise<number> {
  const loan = await tx.loanAccount.findUnique({
    where: { id: loanId },
    select: {
      user_id: true,
      collector: { select: { nickname: true } },
    },
  });

  if (!loan) {
    return 0;
  }

  const overdueSchedules = await tx.repaymentSchedule.findMany({
    where: {
      loan_id: loanId,
      status: 'overdue',
    },
    select: {
      id: true,
      loan_id: true,
      due_start_date: true,
    },
  });

  if (overdueSchedules.length === 0) {
    return 0;
  }

  const scheduleIds = overdueSchedules.map((s) => s.id);
  const existingOverdueRecords = await tx.overdueRecord.findMany({
    where: { schedule_id: { in: scheduleIds } },
    select: { schedule_id: true },
  });
  const scheduleIdsWithRecord = new Set(
    existingOverdueRecords.map((r) => r.schedule_id),
  );

  const schedulesNeedNewRecord = overdueSchedules.filter(
    (s) => !scheduleIdsWithRecord.has(s.id),
  );

  if (schedulesNeedNewRecord.length === 0) {
    return 0;
  }

  const label = collectorLabel(loan.collector?.nickname);

  await tx.overdueRecord.createMany({
    data: schedulesNeedNewRecord.map((schedule) => ({
      user_id: loan.user_id,
      loan_id: schedule.loan_id,
      schedule_id: schedule.id,
      collector: label,
      overdue_date: schedule.due_start_date,
    })),
    skipDuplicates: true,
  });

  await tx.user.update({
    where: { id: loan.user_id },
    data: { overdue_time: { increment: schedulesNeedNewRecord.length } },
  });

  return schedulesNeedNewRecord.length;
}

/**
 * Remove stale overdue records, then create any missing ones for overdue schedules.
 */
export async function reconcileOverdueRecordsForLoan(
  tx: Prisma.TransactionClient,
  loanId: number,
): Promise<{ removed: number; added: number }> {
  const removed = await removeStaleOverdueRecordsForLoan(tx, loanId);
  const added = await ensureOverdueRecordsForLoan(tx, loanId);
  return { removed, added };
}
