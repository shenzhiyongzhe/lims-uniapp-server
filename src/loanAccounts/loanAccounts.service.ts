import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoanAccount,
  LoanAccountStatus,
  ManagementRoles,
  RepaymentScheduleStatus,
} from '@prisma/client';
import { CreateLoanAccountDto } from './dto/create-loanAccount.dto';
import { UpdateLoanAccountDto } from './dto/update-loanAccount.dto';
import { UpdateLoanAccountStatusDto } from './dto/update-loan-account-status.dto';

import { LoanPredictionService } from '../loan-prediction/loan-prediction.service';
import { AssetManagementService } from '../asset-management/asset-management.service';
import {
  getShanghaiBusinessTodayAndYesterday,
  getBusinessDayTimestampRange,
} from '../common/business-date';
import {
  ensureOverdueRecordsForLoan,
  reconcileOverdueRecordsForLoan,
  removeOverdueRecordsForSchedules,
} from '../common/sync-overdue-records';
import { AccessScopeService } from '../access-scope/access-scope.service';

@Injectable()
export class LoanAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanPredictionService: LoanPredictionService,
    private readonly assetManagementService: AssetManagementService,
    private readonly accessScopeService: AccessScopeService,
  ) { }

  private async logOperation(
    tx: any,
    loanId: number,
    operatorAdminId: number | undefined,
    actionType: string,
    content: string,
  ) {
    let operatorAdminName: string | null = null;
    if (operatorAdminId) {
      const staff = await tx.staff.findUnique({
        where: { id: operatorAdminId },
        select: { username: true },
      });
      if (staff && staff.username) {
        operatorAdminName = `${staff.username}(${operatorAdminId})`;
      } else {
        operatorAdminName = `ID:${operatorAdminId}`;
      }
    }

    await tx.loanAccountOperationLog.create({
      data: {
        loan_id: loanId,
        operator_admin_id: operatorAdminId || null,
        operator_admin_name: operatorAdminName,
        action_type: actionType,
        content,
      },
    });
  }

  async findOperationLogs(loanId: number) {
    return this.prisma.loanAccountOperationLog.findMany({
      where: { loan_id: loanId },
      orderBy: { created_at: 'desc' },
    });
  }

  /** 创建/编辑方案时下拉：全部负责人与风控，不按当前用户关联过滤 */
  async findAssignableStaffs() {
    return this.prisma.staff.findMany({
      where: {
        role: {
          in: [ManagementRoles.COLLECTOR, ManagementRoles.RISK_CONTROLLER],
        },
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        role: true,
      },
      orderBy: [{ role: 'asc' }, { nickname: 'asc' }, { username: 'asc' }],
    });
  }

  private toNumber(value?: unknown): number {
    if (value === null || value === undefined) return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private isOverdue(date: Date): boolean {
    const { today } = getShanghaiBusinessTodayAndYesterday();
    const dateUTC = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    return dateUTC < today;
  }

  private determineScheduleStatus(
    endDate: Date,
    currentStatus: RepaymentScheduleStatus,
  ): RepaymentScheduleStatus {
    if (currentStatus === 'paid') {
      return 'paid';
    }
    if (this.isOverdue(endDate)) {
      return 'overdue';
    }
    return 'pending';
  }

  private computeLoanStatistics(loan: {
    loan_amount?: unknown;
    paid_capital?: unknown;
    repaymentSchedules?: Array<{
      capital?: unknown;
      interest?: unknown;
      paid_capital?: unknown;
      paid_interest?: unknown;
      fines?: unknown;
    }>;
  }) {
    const schedules = loan.repaymentSchedules || [];

    const totalCapital = schedules.reduce(
      (sum, schedule) => sum + this.toNumber(schedule.capital),
      0,
    );
    const totalInterest = schedules.reduce(
      (sum, schedule) => sum + this.toNumber(schedule.interest),
      0,
    );
    const paidCapitalFromSchedules = schedules.reduce(
      (sum, schedule) => sum + this.toNumber(schedule.paid_capital),
      0,
    );
    const paidInterest = schedules.reduce(
      (sum, schedule) => sum + this.toNumber(schedule.paid_interest),
      0,
    );
    const remainingCapital = Math.max(
      totalCapital - paidCapitalFromSchedules,
      0,
    );
    const remainingInterest = Math.max(totalInterest - paidInterest, 0);
    const totalFines = schedules.reduce(
      (sum, schedule) => sum + this.toNumber(schedule.fines),
      0,
    );
    const receivingAmount = schedules.reduce(
      (sum, schedule) =>
        sum +
        this.toNumber(schedule.paid_capital) +
        this.toNumber(schedule.paid_interest) +
        this.toNumber(schedule.fines),
      0,
    );
    const paidCapital = this.toNumber(loan.paid_capital);
    const unpaidCapital = Math.max(
      this.toNumber(loan.loan_amount) - paidCapital,
      0,
    );

    return {
      receivingAmount,
      paidCapital,
      paidInterest,
      totalFines,
      unpaidCapital,
      remainingCapital,
      remainingInterest,
    };
  }

  async create(
    data: CreateLoanAccountDto,
    createdBy: number,
  ): Promise<LoanAccount> {
    const {
      due_start_date,
      total_periods,
      daily_repayment,
      period_capital,
      period_interest,
    } = data;

    const parseDate = (dateStr: string): Date => {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, year, month, day] = match;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      }
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
          ),
        );
      }
      return date;
    };

    const startDate = parseDate(due_start_date);
    const endDate = parseDate(data.due_end_date);

    const loan = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.loanAccount.count({
        where: { user_id: data.user_id },
      });

      const applyTimes = existingCount + 1;

      const created = await tx.loanAccount.create({
        data: {
          user_id: data.user_id,
          loan_amount: data.loan_amount,
          receiving_amount: data.receiving_amount,
          risk_controller_id: data.risk_controller_id,
          collector_id: data.collector_id,
          company_cost: data.company_cost,
          handling_fee: data.handling_fee as number,
          to_hand_ratio: data.to_hand_ratio,
          due_start_date: startDate,
          due_end_date: endDate,
          total_periods: Number(total_periods),
          daily_repayment: Number(daily_repayment),
          apply_times: applyTimes,
          period_capital: Number(period_capital),
          period_interest: Number(period_interest),
          last_edit_pay_capital: Number(period_capital),
          last_edit_pay_interest: Number(period_interest),
          status: (data.status as LoanAccountStatus) || 'pending',
          repaid_periods: 0,
          created_by: createdBy,
          note: data.remark || '',
          ownership: data.ownership || null,
          payer_name: data.payer_name?.trim() ? data.payer_name.trim() : null,
        },
      });

      // Record field usage for predictions
      await this.loanPredictionService.updatePredictions(created);

      const periods = Number(total_periods) || 0;
      const perCapital = Number(period_capital) || 0;
      const perInterest = Number(period_interest) || 0;
      let remainingPrincipal = Number(data.loan_amount) || 0;

      const rows = Array.from({ length: periods }).map((_, idx) => {
        const baseDate = new Date(created.due_start_date);
        const d = new Date(
          Date.UTC(
            baseDate.getUTCFullYear(),
            baseDate.getUTCMonth(),
            baseDate.getUTCDate() + idx,
          ),
        );

        let curCapital = 0;
        if (idx < periods - 1) {
          curCapital = Math.min(perCapital, Math.max(0, remainingPrincipal));
        } else {
          curCapital = Math.max(0, remainingPrincipal);
        }

        const curInterest = perInterest;
        const dueAmount = curCapital + curInterest;

        remainingPrincipal = Math.max(0, remainingPrincipal - curCapital);

        const scheduleStatus = this.determineScheduleStatus(d, 'pending');

        return {
          loan_id: created.id,
          period: idx + 1,
          due_start_date: d,
          due_amount: dueAmount,
          capital: curCapital,
          interest: perInterest || null,
          paid_capital: 0,
          paid_interest: 0,
          status: scheduleStatus,
        };
      });

      if (rows.length > 0) {
        await tx.repaymentSchedule.createMany({ data: rows });
      }

      const overdueSchedules = await tx.repaymentSchedule.findMany({
        where: {
          loan_id: created.id,
          status: 'overdue',
        },
      });

      await tx.loanAccount.update({
        where: { id: created.id },
        data: { overdue_count: overdueSchedules.length },
      });

      await ensureOverdueRecordsForLoan(tx, created.id);

      await this.logOperation(
        tx,
        created.id,
        createdBy,
        'create',
        '创建贷款记录',
      );

      return created;
    });

    // 更新 collector 和 risk_controller 资产数据
    try {
      await this.assetManagementService.updateCollectorAssetFromLoanAccount(
        data.collector_id,
        loan,
      );
      await this.assetManagementService.updateRiskControllerAssetFromLoanAccount(
        data.risk_controller_id,
        loan,
      );
    } catch (error) {
      console.error('更新资产数据失败:', error);
    }

    return loan;
  }

  async update(
    id: number,
    data: UpdateLoanAccountDto,
    operatorAdminId?: number,
  ): Promise<LoanAccount> {
    let prevCollectorId: number | undefined;
    let prevRiskId: number | undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const oldLoan = await tx.loanAccount.findUnique({
        where: { id },
        select: {
          user_id: true,
          due_start_date: true,
          collector_id: true,
          risk_controller_id: true,
          loan_amount: true,
          receiving_amount: true,
          to_hand_ratio: true,
          period_capital: true,
          period_interest: true,
          handling_fee: true,
          total_periods: true,
          repaid_periods: true,
          daily_repayment: true,
          status: true,
          company_cost: true,
          apply_times: true,
          note: true,
          ownership: true,
          payer_name: true,
          due_end_date: true,
        },
      });

      if (!oldLoan) {
        throw new Error('贷款记录不存在');
      }

      prevCollectorId = oldLoan.collector_id;
      prevRiskId = oldLoan.risk_controller_id;

      const updateData: any = {};
      let newDueStartDate: Date | null = null;

      if (data.due_start_date) {
        const dateMatch = data.due_start_date.match(
          /^(\d{4})-(\d{2})-(\d{2})$/,
        );
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          const startDate = new Date(
            Date.UTC(Number(year), Number(month) - 1, Number(day)),
          );
          updateData.due_start_date = startDate;
          newDueStartDate = startDate;
        }
      }

      if (data.due_end_date) {
        const dateMatch = data.due_end_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          const endDate = new Date(
            Date.UTC(Number(year), Number(month) - 1, Number(day)),
          );
          updateData.due_end_date = endDate;
        }
      }

      const finalCapital =
        data.period_capital !== undefined
          ? Number(data.period_capital)
          : Number(oldLoan.period_capital || 0);
      const finalInterest =
        data.period_interest !== undefined
          ? Number(data.period_interest)
          : Number(oldLoan.period_interest || 0);
      const finalLoanAmount =
        data.loan_amount !== undefined
          ? Number(data.loan_amount)
          : Number(oldLoan.loan_amount || 0);

      if (data.loan_amount !== undefined)
        updateData.loan_amount = data.loan_amount;
      if (data.receiving_amount !== undefined)
        updateData.receiving_amount = data.receiving_amount;
      if (data.to_hand_ratio !== undefined)
        updateData.to_hand_ratio = data.to_hand_ratio;
      if (data.period_capital !== undefined)
        updateData.period_capital = data.period_capital;
      if (data.period_interest !== undefined)
        updateData.period_interest = data.period_interest;
      if (data.handling_fee !== undefined)
        updateData.handling_fee = data.handling_fee;

      // Calculate total_periods automatically if capital/interest/loan_amount are updated
      if (data.total_periods !== undefined) {
        updateData.total_periods = data.total_periods;
      } else if (
        data.period_capital !== undefined ||
        data.period_interest !== undefined ||
        data.loan_amount !== undefined
      ) {
        if (finalCapital > 0) {
          updateData.total_periods = Math.ceil(finalLoanAmount / finalCapital);
        } else if (finalInterest > 0) {
          updateData.total_periods = Math.ceil(finalLoanAmount / finalInterest);
        } else {
          updateData.total_periods = 0;
        }
      }

      if (data.repaid_periods !== undefined)
        updateData.repaid_periods = data.repaid_periods;

      // Calculate daily_repayment automatically if capital/interest are updated
      if (data.daily_repayment !== undefined) {
        updateData.daily_repayment = data.daily_repayment;
      } else if (
        data.period_capital !== undefined ||
        data.period_interest !== undefined
      ) {
        updateData.daily_repayment = Math.round(finalCapital + finalInterest);
      }

      // Calculate due_end_date automatically if total_periods or due_start_date changes, and due_end_date is not provided
      if (data.due_end_date === undefined) {
        const finalStartDate =
          newDueStartDate ||
          (oldLoan.due_start_date ? new Date(oldLoan.due_start_date) : null);
        const finalPeriods =
          updateData.total_periods !== undefined
            ? updateData.total_periods
            : oldLoan.total_periods;
        if (finalStartDate && finalPeriods > 0) {
          const endDate = new Date(finalStartDate);
          endDate.setUTCDate(finalStartDate.getUTCDate() + finalPeriods - 1);
          updateData.due_end_date = endDate;
        }
      }

      // If due_end_date was updated but total_periods wasn't, calculate total_periods based on dates
      if (data.due_end_date !== undefined && data.total_periods === undefined) {
        const finalStartDate =
          newDueStartDate ||
          (oldLoan.due_start_date ? new Date(oldLoan.due_start_date) : null);
        const finalEndDate =
          updateData.due_end_date ||
          (oldLoan.due_end_date ? new Date(oldLoan.due_end_date) : null);
        if (finalStartDate && finalEndDate) {
          const diffTime = finalEndDate.getTime() - finalStartDate.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
          if (diffDays > 0) {
            updateData.total_periods = diffDays;
          }
        }
      }
      if (data.status !== undefined) updateData.status = data.status;
      if (data.company_cost !== undefined)
        updateData.company_cost = data.company_cost;
      if (data.apply_times !== undefined)
        updateData.apply_times = data.apply_times;
      if (data.risk_controller_id !== undefined)
        updateData.risk_controller_id = data.risk_controller_id;
      if (data.collector_id !== undefined)
        updateData.collector_id = data.collector_id;
      if (data.note !== undefined) updateData.note = data.note;
      if (data.ownership !== undefined) {
        updateData.ownership = data.ownership === '' ? null : data.ownership;
      }
      if (data.payer_name !== undefined) {
        const t = data.payer_name?.trim();
        updateData.payer_name = t ? t : null;
      }

      const updatedRow = await tx.loanAccount.update({
        where: { id },
        data: updateData,
        include: {
          user: true,
          repaymentSchedules: true,
        },
      });

      const isScheduleUpdateNeeded =
        data.period_capital !== undefined ||
        data.period_interest !== undefined ||
        data.loan_amount !== undefined ||
        data.total_periods !== undefined ||
        data.due_start_date !== undefined ||
        data.due_end_date !== undefined;

      if (isScheduleUpdateNeeded) {
        const finalStartDate =
          newDueStartDate ||
          (oldLoan.due_start_date ? new Date(oldLoan.due_start_date) : null);
        const finalPeriods =
          updateData.total_periods !== undefined
            ? updateData.total_periods
            : oldLoan.total_periods;
        const finalCapital =
          updateData.period_capital !== undefined
            ? Number(updateData.period_capital)
            : Number(oldLoan.period_capital || 0);
        const finalInterest =
          updateData.period_interest !== undefined
            ? Number(updateData.period_interest)
            : Number(oldLoan.period_interest || 0);
        const finalLoanAmount =
          updateData.loan_amount !== undefined
            ? Number(updateData.loan_amount)
            : Number(oldLoan.loan_amount || 0);

        if (finalStartDate && finalPeriods > 0) {
          // Fetch existing schedules
          const schedules = await tx.repaymentSchedule.findMany({
            where: { loan_id: id },
            orderBy: { period: 'asc' },
          });

          // Compute new expected schedules
          let remainingPrincipal = finalLoanAmount;
          const calculatedSchedules = Array.from({ length: finalPeriods }).map(
            (_, idx) => {
              let curCapital = 0;
              if (idx < finalPeriods - 1) {
                curCapital = Math.min(
                  finalCapital,
                  Math.max(0, remainingPrincipal),
                );
              } else {
                curCapital = Math.max(0, remainingPrincipal);
              }
              remainingPrincipal = Math.max(0, remainingPrincipal - curCapital);

              const curInterest = finalInterest;
              const dueAmount = curCapital + curInterest;

              const d = new Date(finalStartDate);
              d.setUTCDate(finalStartDate.getUTCDate() + idx);

              return {
                period: idx + 1,
                due_start_date: d,
                capital: curCapital,
                interest: finalInterest || null,
                due_amount: dueAmount,
              };
            },
          );

          // Update existing schedules, create new ones, or delete excess ones
          for (let idx = 0; idx < finalPeriods; idx++) {
            const calc = calculatedSchedules[idx];
            if (idx < schedules.length) {
              // Update existing
              const targetSched = schedules[idx];
              const newStatus = this.determineScheduleStatus(
                calc.due_start_date,
                targetSched.status,
              );
              await tx.repaymentSchedule.update({
                where: { id: targetSched.id },
                data: {
                  period: calc.period,
                  due_start_date: calc.due_start_date,
                  capital: calc.capital,
                  interest: calc.interest,
                  due_amount: calc.due_amount,
                  status: newStatus,
                },
              });
            } else {
              // Create new
              const newStatus = this.determineScheduleStatus(
                calc.due_start_date,
                'pending',
              );
              await tx.repaymentSchedule.create({
                data: {
                  loan_id: id,
                  period: calc.period,
                  due_start_date: calc.due_start_date,
                  capital: calc.capital,
                  interest: calc.interest,
                  due_amount: calc.due_amount,
                  status: newStatus,
                  paid_capital: 0,
                  paid_interest: 0,
                },
              });
            }
          }

          // Delete any extra schedules
          if (schedules.length > finalPeriods) {
            const scheduleIdsToDelete = schedules
              .filter((s) => s.period > finalPeriods)
              .map((s) => s.id);

            await removeOverdueRecordsForSchedules(
              tx,
              oldLoan.user_id,
              scheduleIdsToDelete,
            );

            await tx.repaymentSchedule.deleteMany({
              where: {
                loan_id: id,
                period: { gt: finalPeriods },
              },
            });
          }

          await reconcileOverdueRecordsForLoan(tx, id);

          // Update overdue count on the loan account
          const overdueSchedules = await tx.repaymentSchedule.findMany({
            where: {
              loan_id: id,
              status: 'overdue',
            },
          });
          await tx.loanAccount.update({
            where: { id },
            data: { overdue_count: overdueSchedules.length },
          });
        }
      }

      // Log changes
      const staffs = await tx.staff.findMany({
        select: { id: true, nickname: true, username: true },
      });
      const staffMap = new Map<number, string>(
        staffs.map((s) => [s.id, s.nickname || s.username || `ID:${s.id}`]),
      );

      const changes: string[] = [];
      const formatChangeValue = (val: unknown): string => {
        if (val === null || val === undefined) return '无';
        const s = String(val).trim();
        return s === '' ? '无' : s;
      };
      const compareField = (label: string, fieldName: string) => {
        const oldVal = (oldLoan as any)[fieldName];
        const newVal = (data as any)[fieldName];
        if (newVal === undefined) return;
        if (formatChangeValue(oldVal) === formatChangeValue(newVal)) return;
        changes.push(
          `${label} 从 "${formatChangeValue(oldVal)}" 修改为 "${formatChangeValue(newVal)}"`,
        );
      };

      compareField('贷款金额', 'loan_amount');
      compareField('应收金额', 'receiving_amount');
      compareField('到手比例', 'to_hand_ratio');
      compareField('每期本金', 'period_capital');
      compareField('每期利息', 'period_interest');
      compareField('手续费', 'handling_fee');
      compareField('总期数', 'total_periods');
      compareField('已还期数', 'repaid_periods');
      compareField('日还款额', 'daily_repayment');
      compareField('状态', 'status');
      compareField('公司成本', 'company_cost');
      compareField('申请次数', 'apply_times');
      compareField('备注', 'note');
      compareField('归属', 'ownership');
      compareField('打款人', 'payer_name');

      if (data.due_start_date !== undefined) {
        const oldDateStr = oldLoan.due_start_date
          ? new Date(oldLoan.due_start_date).toISOString().split('T')[0]
          : '无';
        if (oldDateStr !== data.due_start_date) {
          changes.push(
            `应还起始日 从 "${oldDateStr}" 修改为 "${data.due_start_date}"`,
          );
        }
      }

      if (data.due_end_date !== undefined) {
        const oldDateStr = oldLoan.due_end_date
          ? new Date(oldLoan.due_end_date).toISOString().split('T')[0]
          : '无';
        if (oldDateStr !== data.due_end_date) {
          changes.push(
            `到期日 从 "${oldDateStr}" 修改为 "${data.due_end_date}"`,
          );
        }
      }

      if (
        data.collector_id !== undefined &&
        oldLoan.collector_id !== data.collector_id
      ) {
        const oldName =
          staffMap.get(oldLoan.collector_id) || `ID:${oldLoan.collector_id}`;
        const newName =
          staffMap.get(data.collector_id) || `ID:${data.collector_id}`;
        changes.push(`负责人 从 "${oldName}" 修改为 "${newName}"`);
      }

      if (
        data.risk_controller_id !== undefined &&
        oldLoan.risk_controller_id !== data.risk_controller_id
      ) {
        const oldName =
          staffMap.get(oldLoan.risk_controller_id) ||
          `ID:${oldLoan.risk_controller_id}`;
        const newName =
          staffMap.get(data.risk_controller_id) ||
          `ID:${data.risk_controller_id}`;
        changes.push(`风控 从 "${oldName}" 修改为 "${newName}"`);
      }

      if (changes.length > 0) {
        await this.logOperation(
          tx,
          id,
          operatorAdminId,
          'update',
          changes.join(', '),
        );
      }

      return updatedRow;
    });

    try {
      if (data.collector_id !== undefined) {
        if (
          prevCollectorId !== undefined &&
          prevCollectorId !== data.collector_id
        ) {
          await this.assetManagementService.updateCollectorAssetFromLoanAccount(
            prevCollectorId,
            updated,
          );
        }
        await this.assetManagementService.updateCollectorAssetFromLoanAccount(
          data.collector_id,
          updated,
        );
      }
      if (data.risk_controller_id !== undefined) {
        if (
          prevRiskId !== undefined &&
          prevRiskId !== data.risk_controller_id
        ) {
          await this.assetManagementService.updateRiskControllerAssetFromLoanAccount(
            prevRiskId,
            updated,
          );
        }
        await this.assetManagementService.updateRiskControllerAssetFromLoanAccount(
          data.risk_controller_id,
          updated,
        );
      }
    } catch (error) {
      console.error('更新资产数据失败:', error);
    }

    return updated;
  }

  async remove(id: number): Promise<void> {
    const fullLoan = await this.prisma.loanAccount.findUnique({
      where: { id },
      include: {
        user: { select: { username: true } },
        repaymentSchedules: true,
        repaymentRecords: true,
      },
    });

    if (!fullLoan) {
      throw new NotFoundException('贷款记录不存在');
    }

    const { collector_id, risk_controller_id } = fullLoan;

    await this.prisma.$transaction(async (tx) => {
      const backupData = {
        loan: {
          loan_amount: fullLoan.loan_amount,
          receiving_amount: fullLoan.receiving_amount,
          to_hand_ratio: fullLoan.to_hand_ratio,
          period_capital: fullLoan.period_capital,
          period_interest: fullLoan.period_interest,
          due_start_date: fullLoan.due_start_date,
          due_end_date: fullLoan.due_end_date,
          status: fullLoan.status,
          handling_fee: fullLoan.handling_fee,
          total_periods: fullLoan.total_periods,
          repaid_periods: fullLoan.repaid_periods,
          daily_repayment: fullLoan.daily_repayment,
          company_cost: fullLoan.company_cost,
          created_at: fullLoan.created_at,
          created_by: fullLoan.created_by,
          collector_id: fullLoan.collector_id,
          risk_controller_id: fullLoan.risk_controller_id,
          apply_times: fullLoan.apply_times,
          status_changed_at: fullLoan.status_changed_at,
          total_fines: fullLoan.total_fines,
          paid_capital: fullLoan.paid_capital,
          paid_interest: fullLoan.paid_interest,
          early_settlement_capital: fullLoan.early_settlement_capital,
          note: fullLoan.note,
          ownership: fullLoan.ownership,
          payer_name: fullLoan.payer_name,
        },
        schedules: fullLoan.repaymentSchedules.map((s) => ({
          period: s.period,
          due_start_date: s.due_start_date,
          due_amount: s.due_amount,
          capital: s.capital,
          interest: s.interest,
          status: s.status,
          paid_amount: s.paid_amount,
          paid_at: s.paid_at,
          fines: s.fines,
          operator_admin_id: s.operator_admin_id,
          operator_admin_name: s.operator_admin_name,
          paid_capital: s.paid_capital,
          paid_interest: s.paid_interest,
        })),
        repaymentRecords: fullLoan.repaymentRecords.map((r) => ({
          user_id: r.user_id,
          paid_amount: r.paid_amount,
          paid_at: r.paid_at,
          paid_capital: r.paid_capital,
          paid_fines: r.paid_fines,
          paid_interest: r.paid_interest,
          repayment_schedule_period: fullLoan.repaymentSchedules.find(
            (s) => s.id === r.repayment_schedule_id,
          )?.period,
          actual_collector_id: r.actual_collector_id,
          remark: r.remark,
          due_date: r.due_date,
          is_overdue_repaid: r.is_overdue_repaid,
        })),
      };

      await tx.deletedLoan.create({
        data: {
          loan_id: fullLoan.id,
          user_id: fullLoan.user_id,
          username: fullLoan.user?.username || '',
          loan_amount: fullLoan.loan_amount,
          period_capital: fullLoan.period_capital,
          period_interest: fullLoan.period_interest,
          status: fullLoan.status,
          total_periods: fullLoan.total_periods,
          repaid_periods: fullLoan.repaid_periods,
          due_start_date: fullLoan.due_start_date,
          due_end_date: fullLoan.due_end_date,
          data: backupData as any,
        },
      });

      await tx.repaymentRecord.deleteMany({ where: { loan_id: id } });
      await tx.loanAccount.delete({ where: { id } });
    });

    try {
      await this.assetManagementService.updateCollectorAssetFromLoanAccount(
        collector_id,
        fullLoan,
      );
      await this.assetManagementService.updateRiskControllerAssetFromLoanAccount(
        risk_controller_id,
        fullLoan,
      );
    } catch (error) {
      console.error('更新资产数据失败:', error);
    }
  }

  async findById(id: number): Promise<Record<string, unknown> | null> {
    const loan = await this.prisma.loanAccount.findUnique({
      where: { id },
      include: {
        user: true,
        risk_controller: {
          select: { id: true, username: true, nickname: true },
        },
        collector: {
          select: { id: true, username: true, nickname: true },
        },
        creator: {
          select: { id: true, username: true, nickname: true },
        },
        repaymentSchedules: {
          orderBy: { period: 'asc' },
        },
      },
    });
    if (!loan) {
      return null;
    }
    return {
      ...loan,
      statistics: this.computeLoanStatistics(loan),
    };
  }

  async updateAccountStatus(
    id: number,
    dto: UpdateLoanAccountStatusDto,
    operatorAdminId?: number,
  ): Promise<void> {
    const { status, settlement_capital, settlement_date } = dto;

    if (status === 'settled' || status === 'blacklist') {
      const EARLY_REMARK = '提前结清';
      const EARLY_REMARK_LEGACY = 'EARLY_SET';

      await this.prisma.$transaction(async (tx) => {
        const loan = await tx.loanAccount.findUnique({
          where: { id },
          include: {
            repaymentSchedules: { orderBy: { period: 'asc' } },
          },
        });
        if (!loan) {
          throw new Error('贷款记录不存在');
        }

        const schedules = loan.repaymentSchedules;

        let settlementDate: Date;
        const rawDate = settlement_date?.trim();
        if (rawDate) {
          const dateMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateMatch) {
            const [, year, month, day] = dateMatch;
            settlementDate = new Date(
              Date.UTC(Number(year), Number(month) - 1, Number(day)),
            );
          } else {
            const parsed = new Date(rawDate);
            if (Number.isNaN(parsed.getTime())) {
              throw new Error('结清/拉黑日期无效');
            }
            settlementDate = new Date(
              Date.UTC(
                parsed.getUTCFullYear(),
                parsed.getUTCMonth(),
                parsed.getUTCDate(),
              ),
            );
          }
        } else {
          const now = new Date();
          settlementDate = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
          );
        }

        const settlementDateStart = new Date(
          Date.UTC(
            settlementDate.getUTCFullYear(),
            settlementDate.getUTCMonth(),
            settlementDate.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );
        const settlementDateEnd = new Date(
          Date.UTC(
            settlementDate.getUTCFullYear(),
            settlementDate.getUTCMonth(),
            settlementDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );

        const prevTotalReceiving = schedules.reduce(
          (sum, s) => sum + this.toNumber(s.paid_amount),
          0,
        );
        const prevPaidCapital = schedules.reduce(
          (sum, s) => sum + this.toNumber(s.paid_capital),
          0,
        );
        const prevPaidInterest = schedules.reduce(
          (sum, s) => sum + this.toNumber(s.paid_interest),
          0,
        );

        const schedulesToTerminate = schedules.filter((s) => {
          if (s.status === 'active' || s.status === 'paid') {
            return false;
          }
          const d = new Date(s.due_start_date);
          const dayStart = new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
          );
          return dayStart.getTime() >= settlementDateStart.getTime();
        });

        if (schedulesToTerminate.length > 0) {
          await tx.repaymentSchedule.updateMany({
            where: {
              loan_id: id,
              id: { in: schedulesToTerminate.map((s) => s.id) },
            },
            data: { status: 'terminated' },
          });
        }

        const manualCapitalRaw =
          settlement_capital !== undefined && settlement_capital !== null
            ? Number(settlement_capital)
            : NaN;
        const manualCapital = Number.isFinite(manualCapitalRaw)
          ? manualCapitalRaw
          : 0;
        const hasManualSettlement = manualCapital > 0;
        const settlementAmount = hasManualSettlement ? manualCapital : 0;
        const receivingAmount = prevTotalReceiving + settlementAmount;

        let paidCapital: number;
        if (hasManualSettlement) {
          paidCapital = prevPaidCapital + manualCapital;
        } else {
          paidCapital = schedules.reduce(
            (sum, s) => sum + this.toNumber(s.paid_capital),
            0,
          );
        }

        if (settlementAmount > 0) {
          const existingRecord = await tx.repaymentRecord.findFirst({
            where: {
              loan_id: id,
              remark: { in: [EARLY_REMARK, EARLY_REMARK_LEGACY] },
            },
          });
          const recordPayload = {
            paid_amount: settlementAmount,
            paid_at: new Date(),
            paid_capital: hasManualSettlement ? manualCapital : null,
            actual_collector_id: loan.collector_id,
            remark: EARLY_REMARK,
          };
          if (existingRecord) {
            await tx.repaymentRecord.update({
              where: { id: existingRecord.id },
              data: recordPayload,
            });
          } else {
            await tx.repaymentRecord.create({
              data: {
                loan_id: id,
                user_id: loan.user_id,
                ...recordPayload,
              },
            });
          }
        }

        const updateData: Record<string, unknown> = {
          status,
          status_changed_at: new Date(),
          receiving_amount: receivingAmount,
          due_end_date: settlementDateEnd,
          paid_capital: paidCapital,
          paid_interest: prevPaidInterest,
        };

        if (settlement_capital !== undefined && settlement_capital !== null) {
          updateData.early_settlement_capital = manualCapital;
        }

        await tx.loanAccount.update({
          where: { id },
          data: updateData,
        });

        await this.logOperation(
          tx,
          id,
          operatorAdminId,
          'update_status',
          `状态更新为 ${status}${settlement_capital ? `, 提前结清本金: ${settlement_capital}` : ''}`,
        );
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = { status };
      if (status === 'negotiated') {
        updateData.status_changed_at = new Date();
      }
      await tx.loanAccount.update({
        where: { id },
        data: updateData,
      });

      await this.logOperation(
        tx,
        id,
        operatorAdminId,
        'update_status',
        `状态更新为 ${status}`,
      );
    });
  }

  async findAll(): Promise<LoanAccount[]> {
    return this.prisma.loanAccount.findMany({
      include: { user: true },
    });
  }

  private async buildSearchWhereConditions(
    query: { username?: string; id?: string },
    currentUser?: { id: number; role: string },
  ) {
    const baseAndParts: Record<string, unknown>[] = [];

    if (currentUser?.id) {
      const scope = await this.accessScopeService.resolveLoanAccountScope(
        currentUser.id,
        undefined,
      );
      if (!scope.isAllAccessible) {
        baseAndParts.push(scope.whereClause);
      }
    }

    const idTrim = query.id?.trim();
    if (idTrim) {
      const loanId = parseInt(idTrim, 10);
      if (!Number.isNaN(loanId)) {
        baseAndParts.push({ id: loanId });
      }
    }

    const usernameTrim = query.username?.trim();
    if (usernameTrim) {
      baseAndParts.push({
        user: { username: { contains: usernameTrim } },
      });
    }

    return baseAndParts;
  }

  private async computeListStatistics(
    baseAndParts: Record<string, unknown>[],
    customWhereOverdueLoans?: any,
  ) {
    const baseWhere = baseAndParts.length ? { AND: baseAndParts } : {};

    const pendingNegotiatedStatus = {
      status: {
        in: ['pending', 'negotiated'] satisfies LoanAccountStatus[],
      },
    };
    const pendingNegotiatedWhere =
      baseAndParts.length > 0
        ? { AND: [...baseAndParts, pendingNegotiatedStatus] }
        : pendingNegotiatedStatus;

    const blacklistStatus = { status: 'blacklist' as LoanAccountStatus };
    const blacklistWhere =
      baseAndParts.length > 0
        ? { AND: [...baseAndParts, blacklistStatus] }
        : blacklistStatus;

    let overdueWhere = customWhereOverdueLoans;
    if (!overdueWhere) {
      const { yesterday: yesterdayShanghai } = getShanghaiBusinessTodayAndYesterday();
      const activeLoanStatusFilter = {
        status: {
          notIn: ['settled', 'blacklist'] satisfies LoanAccountStatus[],
        },
      };
      const loanAccountWhereForScheduleTabs =
        baseAndParts.length > 0
          ? { AND: [...baseAndParts, activeLoanStatusFilter] }
          : activeLoanStatusFilter;

      const whereOverdueNegotiated =
        baseAndParts.length > 0
          ? { AND: [...baseAndParts, { status: 'negotiated' as const }] }
          : { status: 'negotiated' as const };

      const dayBeforeYesterdayShanghai = new Date(
        yesterdayShanghai.getTime() - 24 * 60 * 60 * 1000,
      );

      const whereOverdueBySchedule = {
        AND: [
          loanAccountWhereForScheduleTabs,
          {
            repaymentSchedules: {
              some: {
                due_start_date: dayBeforeYesterdayShanghai,
                status: 'overdue' as const,
              },
            },
          },
          {
            repaymentSchedules: {
              some: {
                due_start_date: yesterdayShanghai,
                status: 'overdue' as const,
              },
            },
          },
        ],
      };

      overdueWhere = {
        OR: [whereOverdueNegotiated, whereOverdueBySchedule],
      };
    }

    const [pendingNegotiatedAgg, allLoansFeeAgg, blacklistAgg, overdueAgg] =
      await Promise.all([
        this.prisma.loanAccount.aggregate({
          where: pendingNegotiatedWhere,
          _sum: {
            loan_amount: true,
            paid_capital: true,
            paid_interest: true,
          },
        }),
        this.prisma.loanAccount.aggregate({
          where: baseWhere,
          _sum: { handling_fee: true, total_fines: true },
        }),
        this.prisma.loanAccount.aggregate({
          where: blacklistWhere,
          _sum: { loan_amount: true },
        }),
        this.prisma.loanAccount.aggregate({
          where: overdueWhere,
          _sum: { loan_amount: true },
        }),
      ]);

    const inStock = this.toNumber(pendingNegotiatedAgg._sum.loan_amount);
    const remainingDebt =
      this.toNumber(pendingNegotiatedAgg._sum.loan_amount) -
      this.toNumber(pendingNegotiatedAgg._sum.paid_capital);

    return {
      statistics: {
        inStock,
        remainingDebt,
        handlingFee: this.toNumber(allLoansFeeAgg._sum.handling_fee),
        fines: this.toNumber(allLoansFeeAgg._sum.total_fines),
        inStockBlacklist: this.toNumber(blacklistAgg._sum.loan_amount),
        inStockOverdue: this.toNumber(overdueAgg._sum.loan_amount),
      },
    };
  }

  async searchLoanAccounts(
    query: {
      page: number;
      pageSize: number;
      username?: string;
      id?: string;
    },
    currentUser?: { id: number; role: string },
  ) {
    const { page, pageSize, username, id } = query;
    const hasUsername = Boolean(username?.trim());
    const hasId = Boolean(id?.trim());

    if (!hasUsername && !hasId) {
      return {
        data: [],
        total: 0,
        statistics: {
          inStock: 0,
          remainingDebt: 0,
          handlingFee: 0,
          fines: 0,
          inStockBlacklist: 0,
          inStockOverdue: 0,
        },
      };
    }

    const baseAndParts = await this.buildSearchWhereConditions(
      { username, id },
      currentUser,
    );
    const where = baseAndParts.length ? { AND: baseAndParts } : {};
    const skip = (page - 1) * pageSize;

    const loanAccountInclude = {
      user: true,
      collector: { select: { id: true, username: true, nickname: true } },
      risk_controller: { select: { id: true, username: true, nickname: true } },
      creator: { select: { id: true, username: true, nickname: true } },
    };

    const [rows, totalCount, statsResult] = await Promise.all([
      this.prisma.loanAccount.findMany({
        where,
        skip,
        take: pageSize,
        include: loanAccountInclude,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.loanAccount.count({ where }),
      this.computeListStatistics(baseAndParts),
    ]);

    return {
      data: rows.map((loan) => ({
        ...loan,
        __rowKey: String(loan.id),
      })),
      total: totalCount,
      statistics: statsResult.statistics,
    };
  }

  private pickOverdueTabSchedule<T extends { status: string }>(
    loanStatus: string,
    schedules: T[],
  ): T | undefined {
    if (!schedules.length) return undefined;
    if (loanStatus === 'negotiated') {
      return schedules.find((s) => s.status === 'pending') ?? schedules[0];
    }
    return schedules.find((s) => s.status === 'overdue') ?? schedules[0];
  }

  private async buildListWhereConditions(
    query: {
      status?: string;
      listFilter?: string;
      collectorId?: string;
      riskControllerId?: string;
    },
    currentUser?: { id: number; role: string },
  ) {
    const { status, listFilter, collectorId, riskControllerId } = query;

    const baseAndParts: Record<string, unknown>[] = [];
    if (status) {
      baseAndParts.push({ status });
    }

    const collectorIdNum = collectorId ? parseInt(collectorId, 10) : NaN;
    const riskControllerIdNum = riskControllerId
      ? parseInt(riskControllerId, 10)
      : NaN;

    if (currentUser?.id) {
      const scope = await this.accessScopeService.resolveLoanAccountScope(
        currentUser.id,
        Number.isNaN(collectorIdNum) ? undefined : collectorIdNum,
        Number.isNaN(riskControllerIdNum) ? undefined : riskControllerIdNum,
      );
      if (!scope.isAllAccessible) {
        baseAndParts.push(scope.whereClause);
      }
    } else {
      if (!Number.isNaN(collectorIdNum)) {
        baseAndParts.push({
          collector_id: collectorIdNum,
        });
      }
      if (!Number.isNaN(riskControllerIdNum)) {
        baseAndParts.push({
          risk_controller_id: riskControllerIdNum,
        });
      }
    }

    const baseWhere = baseAndParts.length ? { AND: baseAndParts } : {};

    const tab = (listFilter || 'completed').toLowerCase();
    const isScheduleTab =
      tab === 'overdue' || tab === 'today_paid' || tab === 'today_unpaid';

    const { today: todayShanghai, yesterday: yesterdayShanghai } =
      getShanghaiBusinessTodayAndYesterday();

    // blacklist tab: status = blacklist
    const blacklistStatusFilter = { status: 'blacklist' as LoanAccountStatus };
    const whereBlacklist =
      baseAndParts.length > 0
        ? { AND: [...baseAndParts, blacklistStatusFilter] }
        : blacklistStatusFilter;

    // completed tab: status = settled
    const completedStatusFilter = { status: 'settled' as LoanAccountStatus };
    const whereCompleted =
      baseAndParts.length > 0
        ? { AND: [...baseAndParts, completedStatusFilter] }
        : completedStatusFilter;

    const activeLoanStatusFilter = {
      status: {
        notIn: ['settled', 'blacklist'] satisfies LoanAccountStatus[],
      },
    };
    const loanAccountWhereForScheduleTabs =
      baseAndParts.length > 0
        ? { AND: [...baseAndParts, activeLoanStatusFilter] }
        : activeLoanStatusFilter;

    const scheduleWhereOverdue = {
      status: 'overdue' as const,
      loan_account: { is: loanAccountWhereForScheduleTabs },
    };

    const whereOverdueNegotiated =
      baseAndParts.length > 0
        ? { AND: [...baseAndParts, { status: 'negotiated' as const }] }
        : { status: 'negotiated' as const };

    const dayBeforeYesterdayShanghai = new Date(
      yesterdayShanghai.getTime() - 24 * 60 * 60 * 1000,
    );

    const whereOverdueBySchedule = {
      AND: [
        loanAccountWhereForScheduleTabs,
        {
          repaymentSchedules: {
            some: {
              due_start_date: dayBeforeYesterdayShanghai,
              status: 'overdue' as const,
            },
          },
        },
        {
          repaymentSchedules: {
            some: {
              due_start_date: yesterdayShanghai,
              status: 'overdue' as const,
            },
          },
        },
      ],
    };

    const whereOverdueLoans = {
      OR: [whereOverdueNegotiated, whereOverdueBySchedule],
    };

    const todayRange = getBusinessDayTimestampRange(todayShanghai);

    // 查询未来的方案今天已还的还款计划
    const futurePaidSchedules = await this.prisma.repaymentSchedule.findMany({
      where: {
        status: 'paid' as const,
        loan_account: {
          is: {
            AND: [
              loanAccountWhereForScheduleTabs,
              { status: { not: 'negotiated' as const } },
              { due_start_date: { gt: todayShanghai } },
            ],
          },
        },
        repaymentRecords: {
          some: {
            paid_at: {
              gte: todayRange.start,
              lt: todayRange.end,
            },
          },
        },
      },
      select: {
        id: true,
        loan_id: true,
        period: true,
      },
    });

    const futurePaidScheduleMap = new Map<
      number,
      (typeof futurePaidSchedules)[0]
    >();
    for (const sch of futurePaidSchedules) {
      const existing = futurePaidScheduleMap.get(sch.loan_id);
      if (!existing || sch.period > existing.period) {
        futurePaidScheduleMap.set(sch.loan_id, sch);
      }
    }
    const futurePaidScheduleIds = Array.from(
      futurePaidScheduleMap.values(),
    ).map((s) => s.id);

    const scheduleWhereTodayPaid: any = {
      OR: [
        {
          due_start_date: todayShanghai,
          status: 'paid' as const,
          loan_account: { is: loanAccountWhereForScheduleTabs },
        },
      ],
    };

    if (futurePaidScheduleIds.length > 0) {
      scheduleWhereTodayPaid.OR.push({
        id: { in: futurePaidScheduleIds },
      });
    }
    const paidTodayFutureLoanIds = new Set(
      futurePaidSchedules.map((s) => s.loan_id),
    );

    // 先查询未来的方案，并计算顺延的下一期，同时排除今天已还过的方案
    const futureLoans = await this.prisma.loanAccount.findMany({
      where: {
        AND: [
          loanAccountWhereForScheduleTabs,
          { status: { not: 'negotiated' as const } },
          { due_start_date: { gt: todayShanghai } },
          { id: { notIn: Array.from(paidTodayFutureLoanIds) } },
        ],
      },
      select: {
        id: true,
        repaid_periods: true,
      },
    });

    const futureScheduleConditions = futureLoans.map((loan) => ({
      loan_id: loan.id,
      period: loan.repaid_periods + 1,
      status: 'pending' as const,
    }));

    const scheduleWhereTodayUnpaid: any = {
      OR: [
        {
          due_start_date: todayShanghai,
          status: {
            in: ['pending', 'active'] satisfies RepaymentScheduleStatus[],
          },
          loan_account: {
            is: {
              AND: [
                loanAccountWhereForScheduleTabs,
                { status: { not: 'negotiated' as const } },
                { NOT: whereOverdueLoans },
              ],
            },
          },
        },
      ],
    };

    if (futureScheduleConditions.length > 0) {
      scheduleWhereTodayUnpaid.OR.push(...futureScheduleConditions);
    }

    const scheduleMatchTodayPaid: Record<string, unknown> = {
      OR: [
        {
          due_start_date: todayShanghai,
          status: 'paid' as const,
        },
      ],
    };
    if (futurePaidScheduleIds.length > 0) {
      (scheduleMatchTodayPaid.OR as Record<string, unknown>[]).push({
        id: { in: futurePaidScheduleIds },
      });
    }

    const scheduleMatchTodayUnpaid: Record<string, unknown> = {
      OR: [
        {
          due_start_date: todayShanghai,
          status: {
            in: ['pending', 'active'] satisfies RepaymentScheduleStatus[],
          },
        },
      ],
    };
    if (futureScheduleConditions.length > 0) {
      (scheduleMatchTodayUnpaid.OR as Record<string, unknown>[]).push(
        ...futureScheduleConditions,
      );
    }

    // whereOverdueBySchedule and whereOverdueLoans are now defined earlier in the method.

    const scheduleSumWhere = {
      paid_amount: { gt: 0 },
      loan_account: baseWhere,
    };

    const scheduleDayCountBase = {
      due_start_date: todayShanghai,
      loan_account: baseWhere,
    };

    return {
      baseAndParts,
      baseWhere,
      tab,
      isScheduleTab,
      todayShanghai,
      yesterdayShanghai,
      whereBlacklist,
      whereCompleted,
      loanAccountWhereForScheduleTabs,
      scheduleWhereOverdue,
      whereOverdueLoans,
      scheduleWhereTodayPaid,
      scheduleWhereTodayUnpaid,
      scheduleSumWhere,
      scheduleDayCountBase,
    };
  }

  async findGroupedByUser(
    query: {
      page: number;
      pageSize: number;
      status?: string;
      listFilter?: string;
      collectorId?: string;
      riskControllerId?: string;
    },
    currentUser?: { id: number; role: string },
  ) {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const {
      tab,
      isScheduleTab,
      todayShanghai,
      whereBlacklist,
      whereCompleted,
      whereOverdueLoans,
      scheduleWhereTodayPaid,
      scheduleWhereTodayUnpaid,
    } = await this.buildListWhereConditions(query, currentUser);

    const loanAccountInclude = {
      user: true,
      collector: { select: { id: true, username: true, nickname: true } },
      risk_controller: { select: { id: true, username: true, nickname: true } },
      creator: { select: { id: true, username: true, nickname: true } },
    };

    const scheduleWithLatestRecordRemark = {
      repaymentRecords: {
        orderBy: { paid_at: 'desc' as const },
        take: 1,
        select: { remark: true },
      },
    };

    const currentScheduleWhere = isScheduleTab
      ? tab === 'today_paid'
        ? scheduleWhereTodayPaid
        : tab === 'today_unpaid'
          ? scheduleWhereTodayUnpaid
          : null
      : null;

    const [
      countTabBlacklist,
      countTabCompleted,
      countTabOverdue,
      countTabTodayPaid,
      countTabTodayUnpaid,
    ] = await Promise.all([
      this.prisma.loanAccount.count({ where: whereBlacklist }),
      this.prisma.loanAccount.count({ where: whereCompleted }),
      this.prisma.loanAccount.count({ where: whereOverdueLoans }),
      this.prisma.repaymentSchedule.count({ where: scheduleWhereTodayPaid }),
      this.prisma.repaymentSchedule.count({ where: scheduleWhereTodayUnpaid }),
    ]);

    let data: Array<Record<string, unknown>>;
    let total: number;

    if (tab === 'blacklist' || tab === 'completed') {
      const whereTab = tab === 'blacklist' ? whereBlacklist : whereCompleted;
      const rows = await this.prisma.loanAccount.findMany({
        where: whereTab,
        skip,
        take: pageSize,
        include: loanAccountInclude,
        orderBy: { created_at: 'desc' },
      });
      data = rows.map((loan) => ({
        ...loan,
        __rowKey: String(loan.id),
      }));
      total = tab === 'blacklist' ? countTabBlacklist : countTabCompleted;
    } else if (tab === 'overdue') {
      const loanRows = await this.prisma.loanAccount.findMany({
        where: whereOverdueLoans,
        skip,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: {
          ...loanAccountInclude,
          repaymentSchedules: {
            where: {
              status: {
                in: [
                  'overdue',
                  'pending',
                  'active',
                ] satisfies RepaymentScheduleStatus[],
              },
            },
            orderBy: [{ due_start_date: 'asc' }, { period: 'asc' }],
            take: 5,
            include: scheduleWithLatestRecordRemark,
          },
          _count: {
            select: {
              repaymentSchedules: { where: { status: 'overdue' } },
            },
          },
        },
      });
      data = loanRows.map((loan) => {
        const { _count, repaymentSchedules, ...rest } = loan;
        const picked = this.pickOverdueTabSchedule(
          loan.status,
          repaymentSchedules,
        );
        return {
          ...rest,
          repaymentSchedules: picked ? [picked] : [],
          overdueScheduleCount: _count.repaymentSchedules,
          __rowKey: String(loan.id),
        };
      });
      total = countTabOverdue;
    } else {
      const sw = currentScheduleWhere!;
      const scheduleRows = await this.prisma.repaymentSchedule.findMany({
        where: sw,
        skip,
        take: pageSize,
        orderBy: [{ due_start_date: 'desc' }, { period: 'desc' }],
        include: {
          ...scheduleWithLatestRecordRemark,
          loan_account: {
            include: {
              ...loanAccountInclude,
              _count: {
                select: {
                  repaymentSchedules: { where: { status: 'overdue' as const } },
                },
              },
            },
          },
        },
      });
      data = scheduleRows.map((sch) => {
        const { _count, ...loan } = sch.loan_account;
        const isFutureSchedule =
          loan.due_start_date.getTime() > todayShanghai.getTime();
        return {
          ...loan,
          repaymentSchedules: [sch],
          overdueScheduleCount: _count?.repaymentSchedules ?? 0,
          isFutureSchedule,
          __rowKey: `${loan.id}-${sch.id}`,
        };
      });
      total = tab === 'today_paid' ? countTabTodayPaid : countTabTodayUnpaid;
    }

    return {
      data,
      total,
      listFilterCounts: {
        blacklist: countTabBlacklist,
        completed: countTabCompleted,
        overdue: countTabOverdue,
        today_paid: countTabTodayPaid,
        today_unpaid: countTabTodayUnpaid,
      },
    };
  }

  async findListStats(
    query: {
      status?: string;
      listFilter?: string;
      collectorId?: string;
      riskControllerId?: string;
    },
    currentUser?: { id: number; role: string },
  ) {
    const conditions = await this.buildListWhereConditions(
      query,
      currentUser,
    );
    return this.computeListStatistics(
      conditions.baseAndParts,
      conditions.whereOverdueLoans,
    );
  }

  async findDeletedLoans() {
    const [list, staffs] = await Promise.all([
      this.prisma.deletedLoan.findMany({
        orderBy: { deleted_at: 'desc' },
      }),
      this.prisma.staff.findMany({
        select: { id: true, username: true },
      }),
    ]);

    const staffMap = new Map<number, string | null>(
      staffs.map((s) => [s.id, s.username]),
    );

    return list.map((item) => {
      const backup = item.data as any;
      const collector_id = backup?.loan?.collector_id;
      const risk_controller_id = backup?.loan?.risk_controller_id;
      const creator_id = backup?.loan?.created_by;
      return {
        ...item,
        company_cost: backup?.loan?.company_cost ?? null,
        receiving_amount: backup?.loan?.receiving_amount ?? null,
        ownership: backup?.loan?.ownership ?? null,
        apply_times: backup?.loan?.apply_times ?? 0,
        created_by: creator_id || null,
        collector: collector_id
          ? {
              id: collector_id,
              username: staffMap.get(collector_id) || null,
            }
          : null,
        risk_controller: risk_controller_id
          ? {
              id: risk_controller_id,
              username: staffMap.get(risk_controller_id) || null,
            }
          : null,
        creator: creator_id
          ? {
              id: creator_id,
              username: staffMap.get(creator_id) || null,
            }
          : null,
      };
    });
  }

  async findHistoryCreatedLoans(
    query: { page: number; pageSize: number },
    currentUser?: { id: number; role: string },
  ) {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;
    let where: Record<string, unknown> = {};
    if (currentUser?.id) {
      const scope = await this.accessScopeService.resolveLoanAccountScope(
        currentUser.id,
        undefined,
        undefined,
      );
      if (!scope.isAllAccessible) {
        where = scope.whereClause || {};
      }
    }
    const [loans, total] = await Promise.all([
      this.prisma.loanAccount.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
          user: true,
          collector: { select: { id: true, username: true, nickname: true } },
          risk_controller: { select: { id: true, username: true, nickname: true } },
          creator: { select: { id: true, username: true, nickname: true } },
        },
        skip,
        take: pageSize,
      }),
      this.prisma.loanAccount.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: loans.map((loan) => ({
        id: loan.id,
        loan_id: loan.id,
        user_id: loan.user_id,
        username: loan.user?.username || '',
        loan_amount: loan.loan_amount,
        company_cost: loan.company_cost,
        receiving_amount: loan.receiving_amount,
        period_capital: loan.period_capital,
        period_interest: loan.period_interest,
        status: loan.status,
        total_periods: loan.total_periods,
        repaid_periods: loan.repaid_periods,
        due_start_date: loan.due_start_date,
        due_end_date: loan.due_end_date,
        created_at: loan.created_at,
        ownership: loan.ownership,
        apply_times: loan.apply_times,
        collector: loan.collector,
        risk_controller: loan.risk_controller,
        created_by: loan.created_by,
        creator: loan.creator,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async restoreDeletedLoan(loanId: number, restoredBy: number): Promise<any> {
    const deletedRecord = await this.prisma.deletedLoan.findUnique({
      where: { loan_id: loanId },
    });

    if (!deletedRecord) {
      throw new NotFoundException('该删除记录不存在');
    }

    const backup = deletedRecord.data as any;
    const loanData = backup.loan;
    const schedulesData = backup.schedules || [];
    const recordsData = backup.repaymentRecords || [];

    const restored = await this.prisma.$transaction(async (tx) => {
      const created = await tx.loanAccount.create({
        data: {
          id: loanId,
          user_id: deletedRecord.user_id,
          loan_amount: loanData.loan_amount,
          receiving_amount: loanData.receiving_amount,
          risk_controller_id: loanData.risk_controller_id,
          collector_id: loanData.collector_id,
          company_cost: loanData.company_cost,
          handling_fee: loanData.handling_fee,
          to_hand_ratio: loanData.to_hand_ratio,
          due_start_date: new Date(loanData.due_start_date),
          due_end_date: new Date(loanData.due_end_date),
          total_periods: loanData.total_periods,
          repaid_periods: loanData.repaid_periods,
          daily_repayment: loanData.daily_repayment,
          apply_times: loanData.apply_times,
          period_capital:
            loanData.period_capital !== undefined
              ? loanData.period_capital
              : loanData.capital,
          period_interest:
            loanData.period_interest !== undefined
              ? loanData.period_interest
              : loanData.interest,
          last_edit_pay_capital:
            loanData.period_capital !== undefined
              ? loanData.period_capital
              : loanData.capital,
          last_edit_pay_interest:
            loanData.period_interest !== undefined
              ? loanData.period_interest
              : loanData.interest,
          status: loanData.status,
          total_fines: loanData.total_fines,
          paid_capital: loanData.paid_capital,
          paid_interest: loanData.paid_interest,
          early_settlement_capital: loanData.early_settlement_capital,
          status_changed_at: loanData.status_changed_at
            ? new Date(loanData.status_changed_at)
            : null,
          note: loanData.note,
          ownership: loanData.ownership,
          payer_name: loanData.payer_name,
          created_by: loanData.created_by,
        },
      });

      const scheduleIdMap = new Map<number, number>();
      for (const s of schedulesData) {
        const createdSchedule = await tx.repaymentSchedule.create({
          data: {
            loan_id: created.id,
            period: s.period,
            due_start_date: new Date(s.due_start_date),
            due_amount: s.due_amount,
            capital: s.capital,
            interest: s.interest,
            status: s.status,
            paid_amount: s.paid_amount,
            paid_at: s.paid_at ? new Date(s.paid_at) : null,
            fines: s.fines,
            operator_admin_id: s.operator_admin_id,
            operator_admin_name: s.operator_admin_name,
            paid_capital: s.paid_capital,
            paid_interest: s.paid_interest,
          },
        });
        scheduleIdMap.set(s.period, createdSchedule.id);
      }

      for (const r of recordsData) {
        let scheduleId: number | null = null;
        if (r.repayment_schedule_period !== undefined) {
          scheduleId = scheduleIdMap.get(r.repayment_schedule_period) || null;
        }
        await tx.repaymentRecord.create({
          data: {
            loan_id: created.id,
            user_id: r.user_id,
            paid_amount: r.paid_amount,
            paid_at: new Date(r.paid_at),
            paid_capital: r.paid_capital,
            paid_fines: r.paid_fines,
            paid_interest: r.paid_interest,
            repayment_schedule_id: scheduleId,
            actual_collector_id: r.actual_collector_id,
            remark: r.remark,
            due_date: r.due_date ? new Date(r.due_date) : null,
            is_overdue_repaid: r.is_overdue_repaid,
          },
        });
      }

      await this.logOperation(
        tx,
        created.id,
        restoredBy,
        'restore',
        '恢复贷款记录（从回收站）',
      );

      await tx.deletedLoan.delete({
        where: { id: deletedRecord.id },
      });

      return created;
    });

    try {
      await this.assetManagementService.updateCollectorAssetFromLoanAccount(
        restored.collector_id,
        restored,
      );
      await this.assetManagementService.updateRiskControllerAssetFromLoanAccount(
        restored.risk_controller_id,
        restored,
      );
    } catch (error) {
      console.error('更新资产数据失败:', error);
    }

    return restored;
  }

  async getOverdueRecords(loanId: number) {
    return this.prisma.overdueRecord.findMany({
      where: { loan_id: loanId },
      orderBy: { overdue_date: 'desc' },
      include: {
        schedule: {
          select: {
            period: true,
            due_amount: true,
            status: true,
          },
        },
      },
    });
  }

  async deleteOverdueRecord(
    loanId: number,
    overdueRecordId: number,
    operator: { id: number; role: string },
  ) {
    const loan = await this.prisma.loanAccount.findUnique({
      where: { id: loanId },
      select: { collector_id: true, user_id: true },
    });
    if (!loan) {
      throw new NotFoundException('贷款记录不存在');
    }

    const record = await this.prisma.overdueRecord.findUnique({
      where: { id: overdueRecordId },
    });
    if (!record || record.loan_id !== loanId) {
      throw new NotFoundException('逾期记录不存在');
    }

    // Auth check: SUPER_ADMIN, ADMIN, or assigned COLLECTOR
    const isSuperAdmin = operator.role === 'SUPER_ADMIN';
    const isAdmin = operator.role === 'ADMIN';
    const isAssignedCollector =
      operator.role === 'COLLECTOR' && loan.collector_id === operator.id;

    if (!isSuperAdmin && !isAdmin && !isAssignedCollector) {
      throw new ForbiddenException('您没有权限删除该逾期记录');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.overdueRecord.delete({
        where: { id: overdueRecordId },
      });

      const user = await tx.user.findUnique({
        where: { id: loan.user_id },
        select: { overdue_time: true },
      });
      const current = user?.overdue_time ?? 0;
      const next = Math.max(0, current - 1);

      await tx.user.update({
        where: { id: loan.user_id },
        data: { overdue_time: next },
      });

      // Fetch operator staff username
      const staff = await tx.staff.findUnique({
        where: { id: operator.id },
        select: { username: true },
      });
      const staffName =
        staff && staff.username
          ? `${staff.username}(${operator.id})`
          : staff
            ? `ID:${operator.id}`
            : operator.role;

      // Log this manual deletion in LoanAccountOperationLog
      await tx.loanAccountOperationLog.create({
        data: {
          loan_id: loanId,
          operator_admin_id: operator.id,
          operator_admin_name: staffName,
          action_type: 'delete_overdue_record',
          content: `手动删除逾期记录 ID:${overdueRecordId} (逾期日期: ${record.overdue_date.toISOString().split('T')[0]})`,
        },
      });
    });
  }
}
