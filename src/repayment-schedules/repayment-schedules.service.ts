import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RepaymentSchedule,
  RepaymentScheduleStatus,
} from '@prisma/client';
import { RepaymentScheduleResponseDto } from './dto/repayment-schedule-response.dto';

@Injectable()
export class RepaymentSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async update(
    data: Partial<RepaymentSchedule> & {
      pay_capital?: number;
      pay_interest?: number;
      fines?: number;
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

      const { pay_capital, pay_interest, ...restData } = data;
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

      // 只要本期存在已还金额，则标记为手动收款并记录操作人
      if (currentSchedule.operator_admin_name == null) {
        updatePayload.collected_by_type = 'manual';
      }
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
      const repaidPeriods = allSchedules.filter(s => s.status === 'paid').length;

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

      if (nextPaid > 0 && loan) {
        await tx.repaymentRecord.create({
          data: {
            loan_id: loanId,
            user_id: loan.user_id,
            paid_amount: nextPaid,
            paid_capital: inputCapital,
            paid_interest: inputInterest,
            paid_fines: finesValue,
            repayment_schedule_id: data.id,
            actual_collector_id: operatorAdminId ?? null,
          },
        });
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
