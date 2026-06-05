import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RepaymentSchedule, RepaymentScheduleStatus } from '@prisma/client';

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
import { getShanghaiBusinessTodayAndYesterday } from '../common/business-date';

@Injectable()
export class RepaymentSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

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
    operatorAdminId?: number,
  ): Promise<RepaymentSchedule> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. 获取更新前的还款计划数据
      const currentSchedule = await tx.repaymentSchedule.findUnique({
        where: { id: data.id },
        select: {
          loan_id: true,
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
      const inputCapital = Number(data.pay_capital) || 0;
      const inputInterest = Number(data.pay_interest) || 0;

      const baseCapital = toNumber(currentSchedule.capital);
      const baseInterest = toNumber(currentSchedule.interest);

      const actionType: ScheduleOperationType =
        data.action_type === 'collect' ? 'collect' : 'edit';

      const { pay_capital, pay_interest, remark, action_type, ...restData } =
        data;
      const updatePayload: any = {
        ...restData,
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

      // 获取操作人名称（用于手动收款写入）
      let operatorName: string | null = null;
      if (operatorAdminId) {
        const op = await tx.admin.findUnique({
          where: { id: operatorAdminId },
          select: { nickname: true },
        });
        operatorName = op?.nickname ?? null;
      }
      const paidAmount = inputCapital + inputInterest + finesValue;
      const nextPaid = Number(paidAmount.toFixed(2));
      updatePayload.paid_amount = nextPaid;

      if (operatorAdminId) {
        updatePayload.operator_admin_id = operatorAdminId;
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
          operator_admin_id: operatorAdminId ?? null,
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

      // 2. 更新还款计划
      const updatedSchedule = await tx.repaymentSchedule.update({
        where: { id: data.id },
        data: updatePayload,
      });

      // 3. 同步对应的还款记录（保持一条记录，与本期还款计划金额一致）
      const loanId = currentSchedule.loan_id;

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
        },
      });

      // 每期 schedule 仅对应一条还款记录：已存在则更新，否则在有实收时新建
      if (loan) {
        const existingRecord = await tx.repaymentRecord.findFirst({
          where: { repayment_schedule_id: data.id },
        });
        const { today: shanghaiTodayStart } =
          getShanghaiBusinessTodayAndYesterday();
        const recordPayload = {
          loan_id: loanId,
          user_id: loan.user_id,
          paid_amount: nextPaid,
          paid_at: new Date(),
          paid_capital: inputCapital,
          paid_interest: inputInterest,
          paid_fines: finesValue,
          repayment_schedule_id: data.id,
          actual_collector_id: operatorAdminId ?? null,
          remark: remark || null,
          due_date: currentSchedule.due_start_date,
          is_overdue_repaid:
            currentSchedule.due_start_date < shanghaiTodayStart,
        };

        if (existingRecord) {
          await tx.repaymentRecord.update({
            where: { id: existingRecord.id },
            data: recordPayload,
          });
        } else if (nextPaid > 0) {
          await tx.repaymentRecord.create({ data: recordPayload });
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

      return updatedSchedule;
    });
  }

  async create(loanId: number): Promise<RepaymentSchedule> {
    return await this.prisma.$transaction(async (tx) => {
      const allSchedules = await tx.repaymentSchedule.findMany({
        where: {
          loan_id: loanId,
        },
        orderBy: {
          period: 'desc',
        },
        take: 1,
      });

      if (allSchedules.length === 0) {
        throw new NotFoundException('该贷款账户没有还款计划，无法添加新期数');
      }

      const lastSchedule = allSchedules[0];

      const loanAccount = await tx.loanAccount.findUnique({
        where: { id: loanId },
        select: {
          total_periods: true,
        },
      });

      if (!loanAccount) {
        throw new NotFoundException('贷款账户不存在');
      }

      const newPeriod = lastSchedule.period + 1;
      const lastDate = new Date(lastSchedule.due_start_date);
      const newDate = new Date(
        Date.UTC(
          lastDate.getUTCFullYear(),
          lastDate.getUTCMonth(),
          lastDate.getUTCDate() + 1,
        ),
      );

      const toNumber = (value?: any) =>
        value !== null && value !== undefined ? Number(value) : 0;

      const capital = toNumber(lastSchedule.capital);
      const interest = toNumber(lastSchedule.interest);
      const dueAmount = capital + interest;

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

      await tx.loanAccount.update({
        where: { id: loanId },
        data: {
          total_periods: loanAccount.total_periods + 1,
        },
      });

      return newSchedule;
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
            capital: Number(schedule.loan_account.capital),
            interest: Number(schedule.loan_account.interest),
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
