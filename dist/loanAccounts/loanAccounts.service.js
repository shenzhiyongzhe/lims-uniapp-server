"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanAccountsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const loan_prediction_service_1 = require("../loan-prediction/loan-prediction.service");
const asset_management_service_1 = require("../asset-management/asset-management.service");
const business_date_1 = require("../common/business-date");
let LoanAccountsService = class LoanAccountsService {
    prisma;
    loanPredictionService;
    assetManagementService;
    constructor(prisma, loanPredictionService, assetManagementService) {
        this.prisma = prisma;
        this.loanPredictionService = loanPredictionService;
        this.assetManagementService = assetManagementService;
    }
    isOverdue(date) {
        const now = new Date();
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const dateUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
        return dateUTC < todayStart;
    }
    determineScheduleStatus(endDate, currentStatus) {
        if (currentStatus === 'paid') {
            return 'paid';
        }
        if (this.isOverdue(endDate)) {
            return 'overdue';
        }
        return 'pending';
    }
    async create(data, createdBy) {
        const { due_start_date, total_periods, daily_repayment, capital, interest, } = data;
        const parseDate = (dateStr) => {
            const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) {
                const [, year, month, day] = match;
                return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
            }
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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
                    handling_fee: data.handling_fee,
                    to_hand_ratio: data.to_hand_ratio,
                    due_start_date: startDate,
                    due_end_date: endDate,
                    total_periods: Number(total_periods),
                    daily_repayment: Number(daily_repayment),
                    apply_times: applyTimes,
                    capital: Number(capital),
                    interest: Number(interest),
                    status: data.status || 'pending',
                    repaid_periods: 0,
                    created_by: createdBy,
                    note: data.remark || '',
                    ownership: data.ownership || null,
                },
            });
            await this.loanPredictionService.updatePredictions(created);
            const periods = Number(total_periods) || 0;
            const perCapital = Number(capital) || 0;
            const perInterest = Number(interest) || 0;
            let remainingPrincipal = Number(data.loan_amount) || 0;
            const rows = Array.from({ length: periods }).map((_, idx) => {
                const baseDate = new Date(created.due_start_date);
                const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate() + idx));
                let curCapital = 0;
                if (idx < periods - 1) {
                    curCapital = Math.min(perCapital, Math.max(0, remainingPrincipal));
                }
                else {
                    curCapital = Math.max(0, remainingPrincipal);
                }
                curCapital = Number(curCapital.toFixed(2));
                const curInterest = Number(perInterest.toFixed(2));
                const dueAmount = Number((curCapital + curInterest).toFixed(2));
                remainingPrincipal = Number(Math.max(0, remainingPrincipal - curCapital).toFixed(2));
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
        try {
            await this.assetManagementService.updateCollectorAssetFromLoanAccount(data.collector_id, loan);
            await this.assetManagementService.updateRiskControllerAssetFromLoanAccount(data.risk_controller_id, loan);
        }
        catch (error) {
            console.error('更新资产数据失败:', error);
        }
        return loan;
    }
    async update(id, data) {
        return await this.prisma.$transaction(async (tx) => {
            const oldLoan = await tx.loanAccount.findUnique({
                where: { id },
                select: { due_start_date: true },
            });
            if (!oldLoan) {
                throw new Error('贷款记录不存在');
            }
            const updateData = {};
            let newDueStartDate = null;
            if (data.due_start_date) {
                const dateMatch = data.due_start_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (dateMatch) {
                    const [, year, month, day] = dateMatch;
                    const startDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
                    updateData.due_start_date = startDate;
                    newDueStartDate = startDate;
                }
            }
            if (data.due_end_date) {
                const dateMatch = data.due_end_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (dateMatch) {
                    const [, year, month, day] = dateMatch;
                    const endDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
                    updateData.due_end_date = endDate;
                }
            }
            if (data.loan_amount !== undefined)
                updateData.loan_amount = data.loan_amount;
            if (data.receiving_amount !== undefined)
                updateData.receiving_amount = data.receiving_amount;
            if (data.to_hand_ratio !== undefined)
                updateData.to_hand_ratio = data.to_hand_ratio;
            if (data.capital !== undefined)
                updateData.capital = data.capital;
            if (data.interest !== undefined)
                updateData.interest = data.interest;
            if (data.handling_fee !== undefined)
                updateData.handling_fee = data.handling_fee;
            if (data.total_periods !== undefined)
                updateData.total_periods = data.total_periods;
            if (data.repaid_periods !== undefined)
                updateData.repaid_periods = data.repaid_periods;
            if (data.daily_repayment !== undefined)
                updateData.daily_repayment = data.daily_repayment;
            if (data.status !== undefined)
                updateData.status = data.status;
            if (data.company_cost !== undefined)
                updateData.company_cost = data.company_cost;
            if (data.apply_times !== undefined)
                updateData.apply_times = data.apply_times;
            if (data.risk_controller_id !== undefined)
                updateData.risk_controller_id = data.risk_controller_id;
            if (data.collector_id !== undefined)
                updateData.collector_id = data.collector_id;
            if (data.note !== undefined)
                updateData.note = data.note;
            const updated = await tx.loanAccount.update({
                where: { id },
                data: updateData,
                include: {
                    user: true,
                    repaymentSchedules: true,
                },
            });
            if (newDueStartDate && oldLoan.due_start_date) {
                const oldStartDate = new Date(oldLoan.due_start_date);
                const formatUTCDate = (date) => {
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
                        const newStartDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate() + (schedule.period - 1)));
                        const currentSchedule = await tx.repaymentSchedule.findUnique({
                            where: { id: schedule.id },
                            select: { status: true },
                        });
                        const newStatus = this.determineScheduleStatus(newStartDate, currentSchedule?.status || 'pending');
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
            if (data.risk_controller_id !== undefined ||
                data.collector_id !== undefined) {
                if (data.risk_controller_id !== undefined) {
                    await tx.loanAccountRole.deleteMany({
                        where: { loan_account_id: id, role_type: 'risk_controller' },
                    });
                    await tx.loanAccountRole.create({
                        data: { loan_account_id: id, admin_id: data.risk_controller_id, role_type: 'risk_controller' },
                    });
                }
                if (data.collector_id !== undefined) {
                    await tx.loanAccountRole.deleteMany({
                        where: { loan_account_id: id, role_type: 'collector' },
                    });
                    await tx.loanAccountRole.create({
                        data: { loan_account_id: id, admin_id: data.collector_id, role_type: 'collector' },
                    });
                }
            }
            return updated;
        });
    }
    async findById(id) {
        return this.prisma.loanAccount.findUnique({
            where: { id },
            include: {
                user: true,
                repaymentSchedules: {
                    orderBy: { period: 'asc' },
                },
            },
        });
    }
    async findAll() {
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
                nickname: true,
                role: true,
            },
        });
    }
    async findGroupedByUser(query, currentUser) {
        const { page, pageSize, status, adminId, keyword, username, listFilter, } = query;
        const skip = (page - 1) * pageSize;
        const baseAndParts = [];
        if (status) {
            baseAndParts.push({ status });
        }
        const adminIdNum = adminId ? parseInt(adminId, 10) : NaN;
        if (!Number.isNaN(adminIdNum)) {
            baseAndParts.push({
                loanAccountRoles: { some: { admin_id: adminIdNum } },
            });
        }
        else if (currentUser &&
            (currentUser.role === 'COLLECTOR' ||
                currentUser.role === 'RISK_CONTROLLER')) {
            baseAndParts.push({
                loanAccountRoles: { some: { admin_id: currentUser.id } },
            });
        }
        const usernameTrim = username?.trim();
        if (usernameTrim) {
            baseAndParts.push({
                user: { username: { contains: usernameTrim } },
            });
        }
        else if (keyword?.trim()) {
            baseAndParts.push({
                OR: [
                    { user: { username: { contains: keyword.trim() } } },
                    { note: { contains: keyword.trim() } },
                ],
            });
        }
        const baseWhere = baseAndParts.length ? { AND: baseAndParts } : {};
        const tab = (listFilter || 'history').toLowerCase();
        const listTabParts = [];
        const { today: todayShanghai, yesterday: yesterdayShanghai } = (0, business_date_1.getShanghaiBusinessTodayAndYesterday)();
        if (tab === 'overdue') {
            listTabParts.push({
                repaymentSchedules: { some: { status: 'overdue' } },
            });
        }
        else if (tab === 'today_paid') {
            listTabParts.push({
                repaymentSchedules: {
                    some: { due_start_date: todayShanghai, status: 'paid' },
                },
            });
        }
        else if (tab === 'today_unpaid') {
            listTabParts.push({
                repaymentSchedules: {
                    some: {
                        due_start_date: todayShanghai,
                        status: { in: ['pending', 'active'] },
                    },
                },
            });
        }
        const listAndParts = [...baseAndParts, ...listTabParts];
        const listWhere = listAndParts.length ? { AND: listAndParts } : {};
        const scheduleSumWhere = {
            paid_amount: { gt: 0 },
            loan_account: baseWhere,
        };
        const scheduleDayCountBase = {
            due_start_date: todayShanghai,
            loan_account: baseWhere,
        };
        const withListFilter = (tabExtra) => baseAndParts.length > 0
            ? { AND: [...baseAndParts, tabExtra] }
            : tabExtra;
        const whereTabHistory = baseAndParts.length > 0 ? { AND: [...baseAndParts] } : {};
        const whereTabOverdue = withListFilter({
            repaymentSchedules: { some: { status: 'overdue' } },
        });
        const whereTabTodayPaid = withListFilter({
            repaymentSchedules: {
                some: { due_start_date: todayShanghai, status: 'paid' },
            },
        });
        const whereTabTodayUnpaid = withListFilter({
            repaymentSchedules: {
                some: {
                    due_start_date: todayShanghai,
                    status: { in: ['pending', 'active'] },
                },
            },
        });
        const [data, total, loanRows, todaySchedAgg, yesterdaySchedAgg, relatedAdmins, todaySchedulePaidCount, todaySchedulePendingCount, todayScheduleActiveCount, countTabHistory, countTabOverdue, countTabTodayPaid, countTabTodayUnpaid,] = await Promise.all([
            this.prisma.loanAccount.findMany({
                where: listWhere,
                skip,
                take: pageSize,
                include: {
                    user: true,
                    collector: { select: { id: true, nickname: true } },
                    risk_controller: { select: { id: true, nickname: true } },
                    repaymentSchedules: {
                        where: {
                            due_start_date: todayShanghai,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            this.prisma.loanAccount.count({ where: listWhere }),
            this.prisma.loanAccount.findMany({
                where: baseWhere,
                select: {
                    status: true,
                    loan_amount: true,
                    capital: true,
                    interest: true,
                    paid_capital: true,
                    paid_interest: true,
                    handling_fee: true,
                    total_fines: true,
                },
            }),
            this.prisma.repaymentSchedule.aggregate({
                where: {
                    ...scheduleSumWhere,
                    due_start_date: todayShanghai,
                },
                _sum: { paid_amount: true },
            }),
            this.prisma.repaymentSchedule.aggregate({
                where: {
                    ...scheduleSumWhere,
                    due_start_date: yesterdayShanghai,
                },
                _sum: { paid_amount: true },
            }),
            this.findRelatedAdmins(),
            this.prisma.repaymentSchedule.count({
                where: { ...scheduleDayCountBase, status: 'paid' },
            }),
            this.prisma.repaymentSchedule.count({
                where: { ...scheduleDayCountBase, status: 'pending' },
            }),
            this.prisma.repaymentSchedule.count({
                where: { ...scheduleDayCountBase, status: 'active' },
            }),
            this.prisma.loanAccount.count({ where: whereTabHistory }),
            this.prisma.loanAccount.count({ where: whereTabOverdue }),
            this.prisma.loanAccount.count({ where: whereTabTodayPaid }),
            this.prisma.loanAccount.count({ where: whereTabTodayUnpaid }),
        ]);
        const stats = {
            inStock: 0,
            remainingDebt: 0,
            handlingFee: 0,
            fines: 0,
            todayReceived: Number(todaySchedAgg._sum.paid_amount ?? 0),
            yesterdayReceived: Number(yesterdaySchedAgg._sum.paid_amount ?? 0),
            todaySchedulePaidCount,
            todaySchedulePendingCount,
            todayScheduleActiveCount,
        };
        loanRows.forEach((loan) => {
            if (loan.status !== 'settled') {
                stats.inStock += Number(loan.loan_amount);
                const debt = Number(loan.capital) +
                    Number(loan.interest) -
                    (Number(loan.paid_capital) + Number(loan.paid_interest));
                stats.remainingDebt += Math.max(0, debt);
            }
            stats.handlingFee += Number(loan.handling_fee);
            stats.fines += Number(loan.total_fines);
        });
        return {
            data,
            total,
            statistics: stats,
            relatedAdmins,
            listFilterCounts: {
                history: countTabHistory,
                overdue: countTabOverdue,
                today_paid: countTabTodayPaid,
                today_unpaid: countTabTodayUnpaid,
            },
        };
    }
};
exports.LoanAccountsService = LoanAccountsService;
exports.LoanAccountsService = LoanAccountsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        loan_prediction_service_1.LoanPredictionService,
        asset_management_service_1.AssetManagementService])
], LoanAccountsService);
//# sourceMappingURL=loanAccounts.service.js.map