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
var OverdueSweepService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverdueSweepService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const business_date_1 = require("../common/business-date");
let OverdueSweepService = OverdueSweepService_1 = class OverdueSweepService {
    prisma;
    logger = new common_1.Logger(OverdueSweepService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onApplicationBootstrap() {
        this.logger.log('Running overdue sweep on server startup');
        try {
            await this.sweepYesterdayPendingToOverdue();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown overdue sweep error';
            this.logger.error(`Overdue sweep on startup failed: ${message}`);
        }
    }
    async sweepYesterdayPendingToOverdue() {
        const { yesterday } = (0, business_date_1.getShanghaiBusinessTodayAndYesterday)();
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
        await this.prisma.$transaction(async (tx) => {
            await tx.repaymentSchedule.updateMany({
                where: {
                    id: { in: ids },
                    status: 'pending',
                    due_start_date: yesterday,
                },
                data: { status: 'overdue' },
            });
            const collectorLabel = (nickname) => {
                const s = (nickname ?? '').trim();
                return s.length > 0 ? s.slice(0, 10) : '-';
            };
            await tx.overdueRecord.createMany({
                data: rows.map((row) => ({
                    user_id: row.loan_account.user_id,
                    loan_id: row.loan_id,
                    schedule_id: row.id,
                    collector: collectorLabel(row.loan_account.collector?.nickname),
                    overdue_date: yesterday,
                })),
            });
            const userDeltas = new Map();
            for (const row of rows) {
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
        this.logger.log(`Overdue sweep: marked ${ids.length} schedule(s) overdue for due date ${yesterday.toISOString().slice(0, 10)}`);
    }
};
exports.OverdueSweepService = OverdueSweepService;
__decorate([
    (0, schedule_1.Cron)('0 6 * * *', { timeZone: 'Asia/Shanghai' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OverdueSweepService.prototype, "sweepYesterdayPendingToOverdue", null);
exports.OverdueSweepService = OverdueSweepService = OverdueSweepService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OverdueSweepService);
//# sourceMappingURL=overdue-sweep.service.js.map