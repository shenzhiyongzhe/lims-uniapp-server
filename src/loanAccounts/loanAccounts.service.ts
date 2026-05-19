import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoanAccount,
  LoanAccountStatus,
  RepaymentScheduleStatus,
} from '@prisma/client';
import { CreateLoanAccountDto } from './dto/create-loanAccount.dto';
import { UpdateLoanAccountDto } from './dto/update-loanAccount.dto';
import { UpdateLoanAccountStatusDto } from './dto/update-loan-account-status.dto';

import { LoanPredictionService } from '../loan-prediction/loan-prediction.service';
import { AssetManagementService } from '../asset-management/asset-management.service';
import { getShanghaiBusinessTodayAndYesterday } from '../common/business-date';

@Injectable()
export class LoanAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanPredictionService: LoanPredictionService,
    private readonly assetManagementService: AssetManagementService,
  ) {}

  private toNumber(value?: unknown): number {
    if (value === null || value === undefined) return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private isOverdue(date: Date): boolean {
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

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

    return dateUTC < todayStart;
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
    status: LoanAccountStatus;
    receiving_amount?: unknown;
    paid_capital?: unknown;
    paid_interest?: unknown;
    total_fines?: unknown;
    repaymentSchedules?: Array<{
      capital?: unknown;
      interest?: unknown;
      paid_capital?: unknown;
      paid_interest?: unknown;
      fines?: unknown;
    }>;
  }) {
    const schedules = loan.repaymentSchedules || [];

    if (loan.status === 'settled' || loan.status === 'blacklist') {
      const receivingAmount = this.toNumber(loan.receiving_amount);
      const paidCapital = this.toNumber(loan.paid_capital);
      const paidInterest = this.toNumber(loan.paid_interest);
      const totalFines = this.toNumber(loan.total_fines);
      return {
        receivingAmount,
        paidCapital,
        paidInterest,
        totalFines,
        unpaidCapital: 0,
        remainingCapital: 0,
        remainingInterest: 0,
      };
    }

    const totalCapital = schedules.reduce(
      (sum, schedule) => sum + this.toNumber(schedule.capital),
      0,
    );
    const totalInterest = schedules.reduce(
      (sum, schedule) => sum + this.toNumber(schedule.interest),
      0,
    );
    const paidCapital = schedules.reduce(
      (sum, schedule) => sum + this.toNumber(schedule.paid_capital),
      0,
    );
    const paidInterest = schedules.reduce(
      (sum, schedule) => sum + this.toNumber(schedule.paid_interest),
      0,
    );
    const remainingCapital = Math.max(totalCapital - paidCapital, 0);
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
    const unpaidCapital = remainingCapital;

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
      capital,
      interest,
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
          capital: Number(capital),
          interest: Number(interest),
          last_edit_pay_capital: Number(capital),
          last_edit_pay_interest: Number(interest),
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
      const perCapital = Number(capital) || 0;
      const perInterest = Number(interest) || 0;
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
        curCapital = Number(curCapital.toFixed(2));

        const curInterest = Number(perInterest.toFixed(2));
        const dueAmount = Number((curCapital + curInterest).toFixed(2));

        remainingPrincipal = Number(
          Math.max(0, remainingPrincipal - curCapital).toFixed(2),
        );

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

      await tx.loanAccountRole.createMany({
        data: [
          {
            loan_account_id: created.id,
            admin_id: data.collector_id,
            role_type: 'collector',
          },
          {
            loan_account_id: created.id,
            admin_id: data.risk_controller_id,
            role_type: 'risk_controller',
          },
        ],
        skipDuplicates: true,
      });

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

  async update(id: number, data: UpdateLoanAccountDto): Promise<LoanAccount> {
    let prevCollectorId: number | undefined;
    let prevRiskId: number | undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const oldLoan = await tx.loanAccount.findUnique({
        where: { id },
        select: {
          due_start_date: true,
          collector_id: true,
          risk_controller_id: true,
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

      if (data.loan_amount !== undefined)
        updateData.loan_amount = data.loan_amount;
      if (data.receiving_amount !== undefined)
        updateData.receiving_amount = data.receiving_amount;
      if (data.to_hand_ratio !== undefined)
        updateData.to_hand_ratio = data.to_hand_ratio;
      if (data.capital !== undefined) updateData.capital = data.capital;
      if (data.interest !== undefined) updateData.interest = data.interest;
      if (data.handling_fee !== undefined)
        updateData.handling_fee = data.handling_fee;
      if (data.total_periods !== undefined)
        updateData.total_periods = data.total_periods;
      if (data.repaid_periods !== undefined)
        updateData.repaid_periods = data.repaid_periods;
      if (data.daily_repayment !== undefined)
        updateData.daily_repayment = data.daily_repayment;
      if (data.status !== undefined)
        updateData.status = data.status as LoanAccountStatus;
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

      if (newDueStartDate && oldLoan.due_start_date) {
        const oldStartDate = new Date(oldLoan.due_start_date);
        const formatUTCDate = (date: Date): string => {
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        if (formatUTCDate(oldStartDate) !== formatUTCDate(newDueStartDate)) {
          const schedules = await tx.repaymentSchedule.findMany({
            where: { loan_id: id },
            orderBy: { period: 'asc' },
            select: { id: true, period: true },
          });

          for (const schedule of schedules) {
            const baseDate = new Date(newDueStartDate);
            const newStartDate = new Date(
              Date.UTC(
                baseDate.getUTCFullYear(),
                baseDate.getUTCMonth(),
                baseDate.getUTCDate() + (schedule.period - 1),
              ),
            );

            const currentSchedule = await tx.repaymentSchedule.findUnique({
              where: { id: schedule.id },
              select: { status: true },
            });

            const newStatus = this.determineScheduleStatus(
              newStartDate,
              currentSchedule?.status || 'pending',
            );

            await tx.repaymentSchedule.update({
              where: { id: schedule.id },
              data: {
                due_start_date: newStartDate,
                status: newStatus,
              },
            });
          }
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

      if (
        data.risk_controller_id !== undefined ||
        data.collector_id !== undefined
      ) {
        if (data.risk_controller_id !== undefined) {
          await tx.loanAccountRole.deleteMany({
            where: { loan_account_id: id, role_type: 'risk_controller' },
          });
          await tx.loanAccountRole.create({
            data: {
              loan_account_id: id,
              admin_id: data.risk_controller_id,
              role_type: 'risk_controller',
            },
          });
        }
        if (data.collector_id !== undefined) {
          await tx.loanAccountRole.deleteMany({
            where: { loan_account_id: id, role_type: 'collector' },
          });
          await tx.loanAccountRole.create({
            data: {
              loan_account_id: id,
              admin_id: data.collector_id,
              role_type: 'collector',
            },
          });
        }
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
    const loan = await this.prisma.loanAccount.findUnique({
      where: { id },
    });

    if (!loan) {
      throw new NotFoundException('贷款记录不存在');
    }

    const { collector_id, risk_controller_id } = loan;

    await this.prisma.$transaction(async (tx) => {
      await tx.repaymentRecord.deleteMany({ where: { loan_id: id } });
      await tx.loanAccount.delete({ where: { id } });
    });

    try {
      await this.assetManagementService.updateCollectorAssetFromLoanAccount(
        collector_id,
        loan,
      );
      await this.assetManagementService.updateRiskControllerAssetFromLoanAccount(
        risk_controller_id,
        loan,
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
      });
      return;
    }

    const loan = await this.prisma.loanAccount.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!loan) {
      throw new Error('贷款记录不存在');
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'negotiated') {
      updateData.status_changed_at = new Date();
    }
    await this.prisma.loanAccount.update({
      where: { id },
      data: updateData,
    });
  }

  async findAll(): Promise<LoanAccount[]> {
    return this.prisma.loanAccount.findMany({
      include: { user: true },
    });
  }

  async findRelatedAdmins() {
    return this.prisma.admin.findMany({
      where: {
        role: { in: ['COLLECTOR', 'RISK_CONTROLLER'] },
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        role: true,
      },
    });
  }

  private buildListWhereConditions(
    query: {
      status?: string;
      adminId?: string;
      keyword?: string;
      username?: string;
      listFilter?: string;
    },
    currentUser?: { id: number; role: string },
  ) {
    const { status, adminId, keyword, username, listFilter } = query;

    const baseAndParts: Record<string, unknown>[] = [];
    if (status) {
      baseAndParts.push({ status });
    }

    const adminIdNum = adminId ? parseInt(adminId, 10) : NaN;
    if (!Number.isNaN(adminIdNum)) {
      baseAndParts.push({
        loanAccountRoles: { some: { admin_id: adminIdNum } },
      });
    } else if (
      currentUser &&
      (currentUser.role === 'COLLECTOR' ||
        currentUser.role === 'RISK_CONTROLLER')
    ) {
      baseAndParts.push({
        loanAccountRoles: { some: { admin_id: currentUser.id } },
      });
    }

    const usernameTrim = username?.trim();
    if (usernameTrim) {
      if (/^\d+$/.test(usernameTrim)) {
        const loanId = parseInt(usernameTrim, 10);
        if (!Number.isNaN(loanId)) {
          baseAndParts.push({ id: loanId });
        }
      } else {
        baseAndParts.push({
          user: { username: { contains: usernameTrim } },
        });
      }
    } else if (keyword?.trim()) {
      baseAndParts.push({
        OR: [
          { user: { username: { contains: keyword.trim() } } },
          { note: { contains: keyword.trim() } },
        ],
      });
    }

    const baseWhere = baseAndParts.length ? { AND: baseAndParts } : {};

    const tab = (listFilter || 'history').toLowerCase();
    const isScheduleTab =
      tab === 'overdue' || tab === 'today_paid' || tab === 'today_unpaid';

    const { today: todayShanghai, yesterday: yesterdayShanghai } =
      getShanghaiBusinessTodayAndYesterday();

    const historyStatusFilter = {
      status: { in: ['settled', 'blacklist'] satisfies LoanAccountStatus[] },
    };
    const whereHistory =
      baseAndParts.length > 0
        ? { AND: [...baseAndParts, historyStatusFilter] }
        : historyStatusFilter;

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

    const whereOverdueLoans = {
      AND: [
        loanAccountWhereForScheduleTabs,
        { repaymentSchedules: { some: { status: 'overdue' as const } } },
        {
          NOT: {
            repaymentSchedules: {
              some: {
                OR: [
                  {
                    due_start_date: todayShanghai,
                    status: 'paid' as const,
                  },
                  {
                    due_start_date: yesterdayShanghai,
                    status: 'paid' as const,
                  },
                ],
              },
            },
          },
        },
      ],
    };
    const scheduleWhereTodayPaid = {
      due_start_date: todayShanghai,
      status: 'paid' as const,
      loan_account: { is: loanAccountWhereForScheduleTabs },
    };
    const scheduleWhereTodayUnpaid = {
      due_start_date: todayShanghai,
      status: {
        in: ['pending', 'active'] satisfies RepaymentScheduleStatus[],
      },
      loan_account: { is: loanAccountWhereForScheduleTabs },
    };

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
      whereHistory,
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
      adminId?: string;
      keyword?: string;
      username?: string;
      listFilter?: string;
    },
    currentUser?: { id: number; role: string },
  ) {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const {
      tab,
      isScheduleTab,
      whereHistory,
      whereOverdueLoans,
      scheduleWhereTodayPaid,
      scheduleWhereTodayUnpaid,
    } = this.buildListWhereConditions(query, currentUser);

    const loanAccountInclude = {
      user: true,
      collector: { select: { id: true, username: true, nickname: true } },
      risk_controller: { select: { id: true, username: true, nickname: true } },
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
      countTabHistory,
      countTabOverdue,
      countTabTodayPaid,
      countTabTodayUnpaid,
      relatedAdmins,
    ] = await Promise.all([
      this.prisma.loanAccount.count({ where: whereHistory }),
      this.prisma.loanAccount.count({ where: whereOverdueLoans }),
      this.prisma.repaymentSchedule.count({ where: scheduleWhereTodayPaid }),
      this.prisma.repaymentSchedule.count({ where: scheduleWhereTodayUnpaid }),
      this.findRelatedAdmins(),
    ]);

    let data: Array<Record<string, unknown>>;
    let total: number;

    if (tab === 'history') {
      const [rows, totalCount] = await Promise.all([
        this.prisma.loanAccount.findMany({
          where: whereHistory,
          skip,
          take: pageSize,
          include: loanAccountInclude,
          orderBy: { created_at: 'desc' },
        }),
        this.prisma.loanAccount.count({ where: whereHistory }),
      ]);
      data = rows.map((loan) => ({
        ...loan,
        __rowKey: String(loan.id),
      })) as unknown as Array<Record<string, unknown>>;
      total = totalCount;
    } else if (tab === 'overdue') {
      const [loanRows, totalCount] = await Promise.all([
        this.prisma.loanAccount.findMany({
          where: whereOverdueLoans,
          skip,
          take: pageSize,
          orderBy: { created_at: 'desc' },
          include: {
            ...loanAccountInclude,
            repaymentSchedules: {
              where: { status: 'overdue' },
              orderBy: [{ due_start_date: 'asc' }, { period: 'asc' }],
              take: 1,
              include: scheduleWithLatestRecordRemark,
            },
            _count: {
              select: {
                repaymentSchedules: { where: { status: 'overdue' } },
              },
            },
          },
        }),
        this.prisma.loanAccount.count({ where: whereOverdueLoans }),
      ]);
      data = loanRows.map((loan) => {
        const { _count, ...rest } = loan;
        return {
          ...rest,
          overdueScheduleCount: _count.repaymentSchedules,
          __rowKey: String(loan.id),
        } as unknown as Record<string, unknown>;
      });
      total = totalCount;
    } else {
      const sw = currentScheduleWhere!;
      const [scheduleRows, totalCount] = await Promise.all([
        this.prisma.repaymentSchedule.findMany({
          where: sw,
          skip,
          take: pageSize,
          orderBy: [{ due_start_date: 'desc' }, { period: 'desc' }],
          include: {
            ...scheduleWithLatestRecordRemark,
            loan_account: { include: loanAccountInclude },
          },
        }),
        this.prisma.repaymentSchedule.count({ where: sw }),
      ]);
      data = scheduleRows.map((sch) => {
        const loan = sch.loan_account;
        return {
          ...loan,
          repaymentSchedules: [sch],
          __rowKey: `${loan.id}-${sch.id}`,
        } as unknown as Record<string, unknown>;
      });
      total = totalCount;
    }

    return {
      data,
      total,
      relatedAdmins,
      listFilterCounts: {
        history: countTabHistory,
        overdue: countTabOverdue,
        today_paid: countTabTodayPaid,
        today_unpaid: countTabTodayUnpaid,
      },
    };
  }

  async findListStats(
    query: {
      status?: string;
      adminId?: string;
      keyword?: string;
      username?: string;
      listFilter?: string;
    },
    currentUser?: { id: number; role: string },
  ) {
    const {
      baseAndParts,
      isScheduleTab,
      todayShanghai,
      yesterdayShanghai,
      whereHistory,
      loanAccountWhereForScheduleTabs,
      scheduleSumWhere,
      scheduleDayCountBase,
    } = this.buildListWhereConditions(query, currentUser);

    const statsLoanWhere = isScheduleTab
      ? loanAccountWhereForScheduleTabs
      : whereHistory;

    // For inStock/remainingDebt: exclude settled loans (mirrors original `status !== 'settled'` check).
    // On schedule tabs all loans are already active (not settled/blacklist).
    // On history tab only blacklist loans contribute to inStock.
    const inStockWhere: Record<string, unknown> = isScheduleTab
      ? loanAccountWhereForScheduleTabs
      : baseAndParts.length > 0
        ? {
            AND: [
              ...baseAndParts,
              { status: 'blacklist' as LoanAccountStatus },
            ],
          }
        : { status: 'blacklist' as LoanAccountStatus };

    const [
      loanAgg,
      feeAgg,
      todaySchedAgg,
      yesterdaySchedAgg,
      todaySchedulePaidCount,
      todaySchedulePendingCount,
      todayScheduleActiveCount,
    ] = await Promise.all([
      this.prisma.loanAccount.aggregate({
        where: inStockWhere,
        _sum: {
          loan_amount: true,
          capital: true,
          interest: true,
          paid_capital: true,
          paid_interest: true,
        },
      }),
      this.prisma.loanAccount.aggregate({
        where: statsLoanWhere,
        _sum: { handling_fee: true, total_fines: true },
      }),
      this.prisma.repaymentSchedule.aggregate({
        where: { ...scheduleSumWhere, due_start_date: todayShanghai },
        _sum: { paid_amount: true },
      }),
      this.prisma.repaymentSchedule.aggregate({
        where: { ...scheduleSumWhere, due_start_date: yesterdayShanghai },
        _sum: { paid_amount: true },
      }),
      this.prisma.repaymentSchedule.count({
        where: { ...scheduleDayCountBase, status: 'paid' },
      }),
      this.prisma.repaymentSchedule.count({
        where: { ...scheduleDayCountBase, status: 'pending' },
      }),
      this.prisma.repaymentSchedule.count({
        where: { ...scheduleDayCountBase, status: 'active' },
      }),
    ]);

    const inStock = this.toNumber(loanAgg._sum.loan_amount);
    const remainingDebt = Math.max(
      0,
      this.toNumber(loanAgg._sum.capital) +
        this.toNumber(loanAgg._sum.interest) -
        this.toNumber(loanAgg._sum.paid_capital) -
        this.toNumber(loanAgg._sum.paid_interest),
    );

    return {
      statistics: {
        inStock,
        remainingDebt,
        handlingFee: this.toNumber(feeAgg._sum.handling_fee),
        fines: this.toNumber(feeAgg._sum.total_fines),
        todayReceived: this.toNumber(todaySchedAgg._sum.paid_amount),
        yesterdayReceived: this.toNumber(yesterdaySchedAgg._sum.paid_amount),
      },
      dayScheduleBoard: {
        paid: todaySchedulePaidCount,
        pending: todaySchedulePendingCount,
        active: todayScheduleActiveCount,
      },
    };
  }
}
