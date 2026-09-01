import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RepaymentSchedule, RepaymentScheduleStatus } from '@prisma/client';
import { LoanAccountsService } from '../loanAccounts/loanAccounts.service';

type ScheduleOperationType = 'collect' | 'edit';

interface OperationLogRow {
  id: number;
  schedule_id: number;
  loan_id: number;
  action_type: ScheduleOperationType;
  operator_admin_id: number | null;
  operator_admin_name: string | null;
  paid_capital_before: unknown;
  paid_interest_before: unknown;
  fines_before: unknown;
  paid_capital_after: unknown;
  paid_interest_after: unknown;
  fines_after: unknown;
  remark: string | null;
  created_at: Date;
}
import { RepaymentScheduleResponseDto } from './dto/repayment-schedule-response.dto';
import {
  getShanghaiBusinessDate,
  getBusinessDayTimestampRange,
  getShanghaiBusinessTodayAndYesterday,
} from '../common/business-date';

@Injectable()
export class RepaymentSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanAccountsService: LoanAccountsService,
  ) {}

  /** Prisma client 在 migrate 后需执行 generate；此处兼容 generate 尚未刷新的环境 */
  private get operationLogDelegate(): {
    findMany: (args: object) => Promise<OperationLogRow[]>;
    create: (args: { data: object }) => Promise<unknown>;
  } {
    return (
      this.prisma as unknown as { repaymentScheduleOperationLog: unknown }
    ).repaymentScheduleOperationLog as {
      findMany: (args: object) => Promise<OperationLogRow[]>;
      create: (args: { data: object }) => Promise<unknown>;
    };
  }

  async findByLoanId(loanId: number): Promise<RepaymentSchedule[]> {
    return this.prisma.repaymentSchedule.findMany({
      where: {
        loan_id: loanId,
      },
      orderBy: {
        period: 'asc',
      },
    });
  }

  async findById(id: number): Promise<RepaymentSchedule | null> {
    return this.prisma.repaymentSchedule.findUnique({
      where: { id },
      include: {
        loan_account: {
          include: {
            user: true,
            risk_controller: {
              select: {
                id: true,
                nickname: true,
              },
            },
            collector: {
              select: {
                id: true,
                nickname: true,
              },
            },
            creator: {
              select: {
                id: true,
                nickname: true,
                username: true,
              },
            },
          },
        },
      },
    });
  }

  async findOperationLogs(scheduleId: number) {
    const schedule = await this.prisma.repaymentSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });
    if (!schedule) {
      throw new NotFoundException('还款计划不存在');
    }

    const logs = await this.operationLogDelegate.findMany({
      where: { schedule_id: scheduleId },
      orderBy: { created_at: 'desc' },
    });

    return logs.map((log) => ({
      id: log.id,
      schedule_id: log.schedule_id,
      loan_id: log.loan_id,
      action_type: log.action_type,
      operator_admin_id: log.operator_admin_id,
      operator_admin_name: log.operator_admin_name,
      paid_capital_before: log.paid_capital_before
        ? Number(log.paid_capital_before)
        : null,
      paid_interest_before: log.paid_interest_before
        ? Number(log.paid_interest_before)
        : null,
      fines_before: log.fines_before ? Number(log.fines_before) : null,
      paid_capital_after: log.paid_capital_after
        ? Number(log.paid_capital_after)
        : null,
      paid_interest_after: log.paid_interest_after
        ? Number(log.paid_interest_after)
        : null,
      fines_after: log.fines_after ? Number(log.fines_after) : null,
      remark: log.remark,
      created_at: log.created_at,
    }));
  }

  async update(
    data: Partial<RepaymentSchedule> & {
      pay_capital?: number;
      pay_interest?: number;
      fines?: number;
      remark?: string;
      action_type?: ScheduleOperationType | string;
    },
    operator?: { id: number; role: string },
  ): Promise<RepaymentSchedule> {
    const scheduleRef = await this.prisma.repaymentSchedule.findUnique({
      where: { id: data.id },
      select: { loan_id: true },
    });
    if (!scheduleRef) {
      throw new NotFoundException('还款计划不存在');
    }
    if (operator?.role) {
      await this.loanAccountsService.assertLoanAccountEditable(
        scheduleRef.loan_id,
        operator.role,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. 获取更新前的还款计划数据
      const currentSchedule = await tx.repaymentSchedule.findUnique({
        where: { id: data.id },
        select: {
          loan_id: true,
          period: true,
          capital: true,
          interest: true,
          paid_capital: true,
          paid_interest: true,
          fines: true,
          status: true,
          paid_amount: true,
          operator_admin_name: true,
          due_start_date: true,
        },
      });

      if (!currentSchedule) {
        throw new NotFoundException('还款计划不存在');
      }

      const toNumber = (value?: any) =>
        value !== null && value !== undefined ? Number(value) : 0;

      // 前端传入的 pay_capital / pay_interest 代表「本期已还总金额」
      const inputCapital =
        data.pay_capital !== undefined
          ? Number(data.pay_capital) || 0
          : toNumber(currentSchedule.paid_capital);
      const inputInterest =
        data.pay_interest !== undefined
          ? Number(data.pay_interest) || 0
          : toNumber(currentSchedule.paid_interest);

      const nextCapital =
        data.capital !== undefined
          ? toNumber(data.capital)
          : toNumber(currentSchedule.capital);
      const nextInterest =
        data.interest !== undefined
          ? toNumber(data.interest)
          : toNumber(currentSchedule.interest);

      const baseCapital = nextCapital;
      const baseInterest = nextInterest;

      const actionType: ScheduleOperationType =
        data.action_type === 'collect' ? 'collect' : 'edit';

      const { pay_capital, pay_interest, remark, action_type, ...restData } =
        data;
      const updatePayload: any = {
        ...restData,
        capital: nextCapital,
        interest: nextInterest,
        due_amount: nextCapital + nextInterest,
        paid_capital: inputCapital,
        paid_interest: inputInterest,
      };

      if (updatePayload.fines !== undefined) {
        updatePayload.fines = Number(updatePayload.fines);
      }

      const finesValue =
        updatePayload.fines !== undefined
          ? Number(updatePayload.fines)
          : toNumber(currentSchedule.fines);

      let operatorName: string | null = null;
      if (operator?.id) {
        const op = await tx.staff.findUnique({
          where: { id: operator.id },
          select: { username: true, nickname: true },
        });
        operatorName = op?.username
          ? `${op.username} (${operator.id})`
          : `${op?.nickname} (${operator.id})`;
      }
      const paidAmount = inputCapital + inputInterest + finesValue;
      const nextPaid = paidAmount;
      updatePayload.paid_amount = nextPaid;

      if (operator?.id) {
        updatePayload.operator_admin_id = operator.id;
        updatePayload.operator_admin_name = operatorName;
      }
      let derivedStatus: RepaymentScheduleStatus = currentSchedule.status;
      if (inputCapital >= baseCapital && inputInterest >= baseInterest) {
        derivedStatus = 'paid';
      } else if (paidAmount >= 1) {
        derivedStatus = 'active';
      } else {
        derivedStatus = 'pending';
      }
      updatePayload.status = derivedStatus;
      updatePayload.paid_at = new Date();

      await (
        tx as unknown as {
          repaymentScheduleOperationLog: {
            create: (args: { data: object }) => Promise<unknown>;
          };
        }
      ).repaymentScheduleOperationLog.create({
        data: {
          schedule_id: data.id!,
          loan_id: currentSchedule.loan_id,
          action_type: actionType,
          operator_admin_id: operator?.id ?? null,
          operator_admin_name: operatorName,
          paid_capital_before: toNumber(currentSchedule.paid_capital),
          paid_interest_before: toNumber(currentSchedule.paid_interest),
          fines_before: toNumber(currentSchedule.fines),
          paid_capital_after: inputCapital,
          paid_interest_after: inputInterest,
          fines_after: finesValue,
          remark: remark || null,
        },
      });

      const capitalChanged =
        data.capital !== undefined &&
        nextCapital !== toNumber(currentSchedule.capital);
      const interestChanged =
        data.interest !== undefined &&
        nextInterest !== toNumber(currentSchedule.interest);

      if (capitalChanged || interestChanged) {
        await this.loanAccountsService.logOperation(
          tx,
          currentSchedule.loan_id,
          operator?.id,
          'update',
          `修改第 ${currentSchedule.period} 期应还计划：本金 ¥${toNumber(currentSchedule.capital)} -> ¥${nextCapital}，利息 ¥${toNumber(currentSchedule.interest)} -> ¥${nextInterest}，应还总额 ¥${toNumber(currentSchedule.capital) + toNumber(currentSchedule.interest)} -> ¥${nextCapital + nextInterest}`,
        );
      }

      // 2. 更新还款计划
      const updatedSchedule = await tx.repaymentSchedule.update({
        where: { id: data.id },
        data: updatePayload,
      });

      // 3. 同步还款记录：支持单期多次还款与增量创建还款记录，避免覆盖历史还款时间造成昨日/今日收款统计重复
      const loanId = currentSchedule.loan_id;

      // 计算本期已还金额的增量 Delta
      const prevCapital = toNumber(currentSchedule.paid_capital);
      const prevInterest = toNumber(currentSchedule.paid_interest);
      const prevFines = toNumber(currentSchedule.fines);
      const prevPaidTotal = prevCapital + prevInterest + prevFines;

      const deltaCapital = inputCapital - prevCapital;
      const deltaInterest = inputInterest - prevInterest;
      const deltaFines = finesValue - prevFines;
      const deltaPaidTotal = nextPaid - prevPaidTotal;

      // 查询所有还款计划，汇总 paid_capital 和 paid_interest
      const allSchedules = await tx.repaymentSchedule.findMany({
        where: {
          loan_id: loanId,
        },
        select: {
          status: true,
          paid_capital: true,
          paid_interest: true,
          fines: true,
        },
      });

      // 计算 repaid_periods：状态为 paid 的计划数量
      const repaidPeriods = allSchedules.filter(
        (s) => s.status === 'paid',
      ).length;

      // 汇总所有还款计划的 paid_capital 和 paid_interest
      const totalPaidCapital = allSchedules.reduce(
        (sum, schedule) => sum + Number(schedule.paid_capital || 0),
        0,
      );
      const totalPaidInterest = allSchedules.reduce(
        (sum, schedule) => sum + Number(schedule.paid_interest || 0),
        0,
      );
      const totalFines = allSchedules.reduce(
        (sum, schedule) => sum + Number(schedule.fines || 0),
        0,
      );

      const loan = await tx.loanAccount.findUnique({
        where: { id: loanId },
        select: {
          user_id: true,
          early_settlement_capital: true,
          total_periods: true,
          status: true,
        },
      });

      if (loan && deltaPaidTotal !== 0) {
        const businessDate = getShanghaiBusinessDate();
        const { start: todayStart, end: todayEnd } =
          getBusinessDayTimestampRange(businessDate);
        const { today: shanghaiTodayStart } =
          getShanghaiBusinessTodayAndYesterday();

        // 查找当前业务日（今天）是否已经存在该还款计划的还款记录
        const todayRecord = await tx.repaymentRecord.findFirst({
          where: {
            repayment_schedule_id: data.id,
            paid_at: { gte: todayStart, lt: todayEnd },
          },
          orderBy: { id: 'desc' },
        });

        if (todayRecord) {
          // 同一天内多次修改/还款：更新并累加当天的还款记录
          const updatedAmount =
            Number(todayRecord.paid_amount || 0) + deltaPaidTotal;
          const updatedCapital =
            Number(todayRecord.paid_capital || 0) + deltaCapital;
          const updatedInterest =
            Number(todayRecord.paid_interest || 0) + deltaInterest;
          const updatedFines =
            Number(todayRecord.paid_fines || 0) + deltaFines;

          if (updatedAmount <= 0) {
            await tx.repaymentRecord.delete({
              where: { id: todayRecord.id },
            });
          } else {
            await tx.repaymentRecord.update({
              where: { id: todayRecord.id },
              data: {
                paid_amount: updatedAmount,
                paid_capital: updatedCapital,
                paid_interest: updatedInterest,
                paid_fines: updatedFines,
                actual_collector_id:
                  operator?.id ?? todayRecord.actual_collector_id,
                remark: remark !== undefined ? remark || null : todayRecord.remark,
              },
            });
          }
        } else if (deltaPaidTotal > 0) {
          // 跨天修改或今天首次操作：创建今天的新还款记录（仅在增量大于0时创建）
          await tx.repaymentRecord.create({
            data: {
              loan_id: loanId,
              user_id: loan.user_id,
              paid_amount: deltaPaidTotal,
              paid_at: new Date(),
              paid_capital: deltaCapital,
              paid_interest: deltaInterest,
              paid_fines: deltaFines,
              repayment_schedule_id: data.id,
              actual_collector_id: operator?.id ?? null,
              remark: remark || null,
              due_date: currentSchedule.due_start_date,
              is_overdue_repaid:
                currentSchedule.due_start_date < shanghaiTodayStart,
            },
          });
        }
      }

      const earlySettlementCapital = Number(
        loan?.early_settlement_capital || 0,
      );

      // 按照规则重新计算
      const calculatedPaidCapital = totalPaidCapital + earlySettlementCapital;
      const calculatedPaidInterest = totalPaidInterest;
      const calculatedReceivingAmount =
        calculatedPaidCapital + calculatedPaidInterest + totalFines;

      // 更新 LoanAccount，同时保存上次编辑的输入值
      const inputFines = data.fines !== undefined ? Number(data.fines) : null;
      const updateLoanData: any = {
        receiving_amount: calculatedReceivingAmount,
        paid_capital: calculatedPaidCapital,
        paid_interest: calculatedPaidInterest,
        repaid_periods: repaidPeriods,
        total_fines: totalFines,
        // 保存本次编辑的输入值，下次打开收款弹窗时自动填充
        last_edit_pay_capital: inputCapital,
        last_edit_pay_interest: inputInterest,
        last_edit_fines: inputFines !== null ? inputFines : finesValue,
      };

      if (repaidPeriods === loan?.total_periods) {
        updateLoanData.status = 'settled';
      }

      let shouldLogSettledAutoLock = false;
      if (
        loan &&
        updateLoanData.status === 'settled' &&
        this.loanAccountsService.isTransitionToSettled(loan.status, 'settled')
      ) {
        Object.assign(
          updateLoanData,
          this.loanAccountsService.getSettledAutoLockFields(),
        );
        shouldLogSettledAutoLock = true;
      }

      // 计算该 loanAccount 关联的所有 RepaymentSchedule.status = 'overdue' 的数量
      const overdueCount = await tx.repaymentSchedule.count({
        where: {
          loan_id: loanId,
          status: 'overdue',
        },
      });
      updateLoanData.overdue_count = overdueCount;

      await tx.loanAccount.update({
        where: { id: loanId },
        data: updateLoanData,
      });

      if (shouldLogSettledAutoLock) {
        await this.loanAccountsService.logSettledAutoLock(tx, loanId);
      }

      return updatedSchedule;
    });
  }

  async create(
    loanId: number,
    operator?: { id: number; role: string },
    count?: number,
  ): Promise<RepaymentSchedule[]> {
    if (operator?.role) {
      await this.loanAccountsService.assertLoanAccountEditable(
        loanId,
        operator.role,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const allSchedules = await tx.repaymentSchedule.findMany({
        where: {
          loan_id: loanId,
        },
        orderBy: {
          period: 'asc',
        },
      });

      if (allSchedules.length === 0) {
        throw new NotFoundException('该贷款账户没有还款计划，无法添加新期数');
      }

      const unpaidSchedules = allSchedules.filter(
        (s) => s.status !== 'paid' && s.status !== 'terminated',
      );

      const countToAdd =
        count && count > 0 ? count : unpaidSchedules.length <= 2 ? 10 : 1;

      const lastSchedule = allSchedules[allSchedules.length - 1];

      const loanAccount = await tx.loanAccount.findUnique({
        where: { id: loanId },
        select: {
          total_periods: true,
          period_capital: true,
          period_interest: true,
        },
      });

      if (!loanAccount) {
        throw new NotFoundException('贷款账户不存在');
      }

      const toNumber = (value?: any) =>
        value !== null && value !== undefined ? Number(value) : 0;

      const capital = toNumber(loanAccount.period_capital);
      const interest = toNumber(loanAccount.period_interest);
      const dueAmount = capital + interest;

      const lastDate = new Date(lastSchedule.due_start_date);
      const createdSchedules: RepaymentSchedule[] = [];

      for (let i = 1; i <= countToAdd; i++) {
        const newPeriod = lastSchedule.period + i;
        const newDate = new Date(
          Date.UTC(
            lastDate.getUTCFullYear(),
            lastDate.getUTCMonth(),
            lastDate.getUTCDate() + i,
          ),
        );

        const newSchedule = await tx.repaymentSchedule.create({
          data: {
            loan_id: loanId,
            period: newPeriod,
            due_start_date: newDate,
            due_amount: dueAmount,
            capital: capital,
            interest: interest,
            paid_capital: 0,
            paid_interest: 0,
            fines: 0,
            status: 'pending',
            paid_amount: 0,
          },
        });
        createdSchedules.push(newSchedule);
      }

      const finalSchedule = createdSchedules[createdSchedules.length - 1];

      await tx.loanAccount.update({
        where: { id: loanId },
        data: {
          total_periods: loanAccount.total_periods + countToAdd,
          due_end_date: finalSchedule.due_start_date,
        },
      });

      const startPeriod = createdSchedules[0].period;
      const endPeriod = finalSchedule.period;
      const firstDateStr = new Date(createdSchedules[0].due_start_date)
        .toISOString()
        .split('T')[0];
      const lastDateStr = new Date(finalSchedule.due_start_date)
        .toISOString()
        .split('T')[0];

      const logContent =
        countToAdd === 1
          ? `添加第 ${startPeriod} 期还款计划，应还本金: ¥${capital}，应还利息: ¥${interest}，应还总额: ¥${dueAmount}，到期日: ${firstDateStr}`
          : `添加第 ${startPeriod} 至 ${endPeriod} 期还款计划（共 ${countToAdd} 期），每期本金: ¥${capital}，每期利息: ¥${interest}，每期总额: ¥${dueAmount}，到期日至: ${lastDateStr}`;

      await this.loanAccountsService.logOperation(
        tx,
        loanId,
        operator?.id,
        'add_schedule',
        logContent,
      );

      return createdSchedules;
    });
  }

  toResponse(schedule: any): RepaymentScheduleResponseDto {
    return {
      id: schedule.id,
      loan_id: schedule.loan_id,
      period: schedule.period,
      due_start_date: schedule.due_start_date,
      due_amount: Number(schedule.due_amount),
      capital: schedule.capital ? Number(schedule.capital) : undefined,
      interest: schedule.interest ? Number(schedule.interest) : undefined,
      fines: schedule.fines ? Number(schedule.fines) : undefined,
      status: schedule.status,
      paid_amount: schedule.paid_amount
        ? Number(schedule.paid_amount)
        : undefined,
      paid_at: schedule.paid_at ? schedule.paid_at : undefined,
      loan_account: schedule.loan_account
        ? {
            id: schedule.loan_account.id,
            user_id: schedule.loan_account.user_id,
            loan_amount: Number(schedule.loan_account.loan_amount),
            period_capital: Number(schedule.loan_account.period_capital),
            period_interest: Number(schedule.loan_account.period_interest),
            due_start_date: schedule.loan_account.due_start_date,
            due_end_date: schedule.loan_account.due_end_date,
            status: schedule.loan_account.status,
            handling_fee: Number(schedule.loan_account.handling_fee),
            total_periods: schedule.loan_account.total_periods,
            repaid_periods: schedule.loan_account.repaid_periods,
            daily_repayment: Number(schedule.loan_account.daily_repayment),
            risk_controller:
              schedule.loan_account.risk_controller?.nickname || '',
            collector: schedule.loan_account.collector?.nickname || '',
            creator:
              schedule.loan_account.creator?.nickname ||
              schedule.loan_account.creator?.username ||
              '',
            lender: '', // Not in this schema
            user: schedule.loan_account.user
              ? {
                  id: schedule.loan_account.user.id,
                  username: schedule.loan_account.user.username,
                  overtime: schedule.loan_account.user.overtime,
                  overdue_time: schedule.loan_account.user.overdue_time,
                  is_high_risk: schedule.loan_account.user.is_high_risk,
                }
              : undefined,
          }
        : undefined,
    };
  }
}
