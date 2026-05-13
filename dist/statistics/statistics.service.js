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
exports.StatisticsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let StatisticsService = class StatisticsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getBusinessDayStart(date) {
        const d = date ? new Date(date) : new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }
    getBusinessDayEnd(date) {
        const d = date ? new Date(date) : new Date();
        d.setHours(23, 59, 59, 999);
        return d;
    }
    async getCollectorDetailedStatisticsForAdmin(adminId, roleType, targetDate, selectedAdminId) {
        if (selectedAdminId) {
            return this.getCollectorDetailedStatisticsInternal(selectedAdminId, roleType, targetDate, true);
        }
        if (roleType === 'collector') {
            return this.getAllCollectorsStatisticsSum(targetDate);
        }
        else {
            return this.getAllRiskControllersStatisticsSum(targetDate);
        }
    }
    async getAllCollectorsStatisticsSum(targetDate) {
        const roles = await this.prisma.loanAccountRole.findMany({
            where: { role_type: 'collector' },
            select: { admin_id: true },
            distinct: ['admin_id'],
        });
        const ids = roles.map((r) => r.admin_id);
        if (ids.length === 0)
            return this.getEmptyStatistics();
        const allStats = await Promise.all(ids.map((id) => this.getCollectorDetailedStatisticsInternal(id, 'collector', targetDate, true)));
        return this.sumStatistics(allStats);
    }
    async getAllRiskControllersStatisticsSum(targetDate) {
        const roles = await this.prisma.loanAccountRole.findMany({
            where: { role_type: 'risk_controller' },
            select: { admin_id: true },
            distinct: ['admin_id'],
        });
        const ids = roles.map((r) => r.admin_id);
        if (ids.length === 0)
            return this.getEmptyStatistics();
        const allStats = await Promise.all(ids.map((id) => this.getCollectorDetailedStatisticsInternal(id, 'risk_controller', targetDate, true)));
        return this.sumStatistics(allStats);
    }
    sumStatistics(allStats) {
        return allStats.reduce((acc, stats) => {
            for (const key in acc) {
                acc[key] += Number(stats[key] || 0);
            }
            return acc;
        }, this.getEmptyStatisticsWithYesterday());
    }
    getEmptyStatisticsWithYesterday() {
        return {
            ...this.getEmptyStatistics(),
            yesterdayTotalAmount: 0,
        };
    }
    async getCollectorDetailedStatisticsForCollector(adminId, roleType, targetDate, riskControllerId, collectorId) {
        return this.getCollectorDetailedStatisticsInternal(adminId, roleType, targetDate, true, riskControllerId, collectorId);
    }
    async getCollectorDetailedStatisticsInternal(adminId, roleType, targetDate, includeYesterdayTotal = false, riskControllerId, collectorId) {
        let roles = await this.prisma.loanAccountRole.findMany({
            where: { admin_id: adminId, role_type: roleType },
            select: { loan_account_id: true },
        });
        let loanAccountIds = roles.map((r) => r.loan_account_id);
        if (riskControllerId && roleType === 'collector') {
            const filtered = await this.prisma.loanAccountRole.findMany({
                where: { admin_id: riskControllerId, role_type: 'risk_controller', loan_account_id: { in: loanAccountIds } },
                select: { loan_account_id: true },
            });
            loanAccountIds = filtered.map((r) => r.loan_account_id);
        }
        else if (collectorId && roleType === 'risk_controller') {
            const filtered = await this.prisma.loanAccountRole.findMany({
                where: { admin_id: collectorId, role_type: 'collector', loan_account_id: { in: loanAccountIds } },
                select: { loan_account_id: true },
            });
            loanAccountIds = filtered.map((r) => r.loan_account_id);
        }
        if (loanAccountIds.length === 0)
            return this.getEmptyStatisticsWithYesterday();
        const todayStart = this.getBusinessDayStart(targetDate);
        const todayEnd = this.getBusinessDayEnd(targetDate);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayEnd);
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
        const now = targetDate || new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const allLoanAccounts = await this.prisma.loanAccount.findMany({
            where: { id: { in: loanAccountIds } },
            select: {
                loan_amount: true,
                handling_fee: true,
                total_fines: true,
                receiving_amount: true,
                company_cost: true,
            },
        });
        const totalAmount = allLoanAccounts.reduce((sum, acc) => sum + Number(acc.handling_fee || 0) + Number(acc.receiving_amount || 0) - Number(acc.company_cost || 0), 0);
        const totalInStockAmount = (await this.prisma.loanAccount.findMany({
            where: { id: { in: loanAccountIds }, status: { notIn: ['settled', 'blacklist'] } },
            select: { loan_amount: true },
        })).reduce((sum, acc) => sum + Number(acc.loan_amount), 0);
        const totalHandlingFee = allLoanAccounts.reduce((sum, acc) => sum + Number(acc.handling_fee), 0);
        const totalFines = allLoanAccounts.reduce((sum, acc) => sum + Number(acc.total_fines), 0);
        const totalBlacklistCount = await this.prisma.loanAccount.count({ where: { id: { in: loanAccountIds }, status: 'blacklist' } });
        const totalNegotiatedCount = await this.prisma.loanAccount.count({ where: { id: { in: loanAccountIds }, status: 'negotiated' } });
        const totalInStockCount = await this.prisma.loanAccount.count({ where: { id: { in: loanAccountIds }, status: { in: ['pending', 'negotiated'] } } });
        const totalReceivedAmount = allLoanAccounts.reduce((sum, acc) => sum + Number(acc.receiving_amount || 0), 0);
        const todayRepaymentRecords = await this.prisma.repaymentRecord.findMany({
            where: { loan_id: { in: loanAccountIds }, paid_at: { gte: todayStart, lte: todayEnd } },
            select: { paid_amount: true },
        });
        const todayCollection = todayRepaymentRecords.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0);
        const yesterdayRepaymentRecords = await this.prisma.repaymentRecord.findMany({
            where: { loan_id: { in: loanAccountIds }, paid_at: { gte: yesterdayStart, lt: todayStart } },
            select: { paid_amount: true },
        });
        const yesterdayCollection = yesterdayRepaymentRecords.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0);
        const todayNewAmount = (await this.prisma.loanAccount.findMany({
            where: { id: { in: loanAccountIds }, due_start_date: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) } },
            select: { loan_amount: true },
        })).reduce((sum, acc) => sum + Number(acc.loan_amount), 0);
        const todaySettledAmount = (await this.prisma.loanAccount.findMany({
            where: { id: { in: loanAccountIds }, status: 'settled', due_end_date: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) } },
            select: { loan_amount: true },
        })).reduce((sum, acc) => sum + Number(acc.loan_amount), 0);
        const todayPaidCount = await this.prisma.repaymentSchedule.count({
            where: { loan_id: { in: loanAccountIds }, due_start_date: { gte: todayStart, lte: todayEnd }, status: 'paid' },
        });
        const todayPendingCount = await this.prisma.repaymentSchedule.count({
            where: { loan_id: { in: loanAccountIds }, due_start_date: { gte: todayStart, lt: todayEnd }, status: 'pending' },
        });
        const activeCount = (await this.prisma.repaymentSchedule.groupBy({
            by: ['loan_id'],
            where: { loan_id: { in: loanAccountIds }, status: 'active' },
        })).length;
        const yesterdayOverdueCount = await this.prisma.repaymentSchedule.count({
            where: { loan_id: { in: loanAccountIds }, due_start_date: { gte: yesterdayStart, lt: todayStart }, status: 'overdue' },
        });
        const todayNegotiatedCount = await this.prisma.loanAccount.count({
            where: { id: { in: loanAccountIds }, status: 'negotiated', status_changed_at: { gte: todayStart, lte: todayEnd } },
        });
        const todayBlacklistCount = await this.prisma.loanAccount.count({
            where: { id: { in: loanAccountIds }, status: 'blacklist', status_changed_at: { gte: todayStart, lte: todayEnd } },
        });
        const thisMonthNewAccounts = await this.prisma.loanAccount.findMany({
            where: { id: { in: loanAccountIds }, due_start_date: { gte: thisMonthStart, lt: nextMonthStart } },
            select: { loan_amount: true },
        });
        const thisMonthNewAmount = thisMonthNewAccounts.reduce((sum, acc) => sum + Number(acc.loan_amount), 0);
        const thisMonthSettledAccounts = await this.prisma.loanAccount.findMany({
            where: { id: { in: loanAccountIds }, status: 'settled', due_end_date: { gte: thisMonthStart, lt: nextMonthStart } },
            select: { loan_amount: true },
        });
        const thisMonthSettledAmount = thisMonthSettledAccounts.reduce((sum, acc) => sum + Number(acc.loan_amount), 0);
        const thisMonthAccounts = await this.prisma.loanAccount.findMany({
            where: { id: { in: loanAccountIds }, due_start_date: { gte: thisMonthStart, lt: nextMonthStart } },
            select: { handling_fee: true, total_fines: true },
        });
        const thisMonthHandlingFee = thisMonthAccounts.reduce((sum, acc) => sum + Number(acc.handling_fee), 0);
        const thisMonthFines = thisMonthAccounts.reduce((sum, acc) => sum + Number(acc.total_fines), 0);
        const thisMonthNegotiatedCount = await this.prisma.loanAccount.count({
            where: { id: { in: loanAccountIds }, status: 'negotiated', status_changed_at: { gte: thisMonthStart, lt: nextMonthStart } },
        });
        const thisMonthBlacklistCount = await this.prisma.loanAccount.count({
            where: { id: { in: loanAccountIds }, status: 'blacklist', status_changed_at: { gte: thisMonthStart, lt: nextMonthStart } },
        });
        const lastMonthStart = new Date(thisMonthStart);
        lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
        const lastMonthAccounts = await this.prisma.loanAccount.findMany({
            where: { id: { in: loanAccountIds }, due_start_date: { gte: lastMonthStart, lt: thisMonthStart } },
            select: { handling_fee: true, total_fines: true },
        });
        const lastMonthHandlingFee = lastMonthAccounts.reduce((sum, acc) => sum + Number(acc.handling_fee), 0);
        const lastMonthFines = lastMonthAccounts.reduce((sum, acc) => sum + Number(acc.total_fines), 0);
        const lastMonthBlacklistCount = await this.prisma.loanAccount.count({
            where: { id: { in: loanAccountIds }, status: 'blacklist', status_changed_at: { gte: lastMonthStart, lt: thisMonthStart } },
        });
        const result = {
            totalAmount,
            totalInStockAmount,
            totalHandlingFee,
            totalFines,
            totalBlacklistCount,
            totalNegotiatedCount,
            totalInStockCount,
            totalReceivedAmount,
            todayPaidCount,
            todayPendingCount,
            activeCount,
            todayCollection,
            yesterdayCollection,
            todayNewAmount,
            todaySettledAmount,
            yesterdayOverdueCount,
            todayNegotiatedCount,
            todayBlacklistCount,
            thisMonthNewAmount,
            thisMonthSettledAmount,
            thisMonthHandlingFee,
            thisMonthFines,
            thisMonthNegotiatedCount,
            thisMonthBlacklistCount,
            lastMonthHandlingFee,
            lastMonthFines,
            lastMonthBlacklistCount,
            yesterdayTotalAmount: 0
        };
        if (includeYesterdayTotal) {
            const yesterdayDateForDb = new Date(yesterdayStart.toISOString().split('T')[0] + 'T12:00:00.000Z');
            const yesterdayStats = await this.prisma.dailyStatistics.findUnique({
                where: { admin_id_date_role: { admin_id: adminId, date: yesterdayDateForDb, role: roleType } },
                select: { total_amount: true },
            });
            result.yesterdayTotalAmount = yesterdayStats ? Number(yesterdayStats.total_amount) : 0;
        }
        return result;
    }
    async getAdminStatistics() {
        const roles = await this.prisma.loanAccountRole.findMany({
            where: { role_type: { in: ['collector', 'risk_controller'] } },
            include: { admin: { select: { id: true, nickname: true } } },
            distinct: ['admin_id', 'role_type'],
        });
        const results = [];
        for (const role of roles) {
            const statistics = await this.getCollectorDetailedStatisticsForAdmin(role.admin_id, role.role_type);
            results.push({
                admin_id: role.admin_id,
                admin_name: role.admin.nickname || '',
                role: role.role_type,
                ...statistics,
            });
        }
        return results;
    }
    getEmptyStatistics() {
        return {
            totalAmount: 0,
            totalInStockAmount: 0,
            totalHandlingFee: 0,
            totalFines: 0,
            totalBlacklistCount: 0,
            totalNegotiatedCount: 0,
            totalInStockCount: 0,
            totalReceivedAmount: 0,
            todayPaidCount: 0,
            todayPendingCount: 0,
            activeCount: 0,
            todayCollection: 0,
            yesterdayCollection: 0,
            todayNewAmount: 0,
            todaySettledAmount: 0,
        };
    }
};
exports.StatisticsService = StatisticsService;
exports.StatisticsService = StatisticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StatisticsService);
//# sourceMappingURL=statistics.service.js.map