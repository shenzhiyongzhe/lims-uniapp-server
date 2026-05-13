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
var AssetManagementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetManagementService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AssetManagementService = AssetManagementService_1 = class AssetManagementService {
    prisma;
    logger = new common_1.Logger(AssetManagementService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleInit() {
        this.logger.log('Asset Management Module Initialized');
    }
    async findCollectorAsset(adminId) {
        const admin = await this.prisma.admin.findUnique({
            where: { id: adminId },
            select: { id: true, nickname: true },
        });
        const asset = await this.prisma.collectorAssetManagement.findUnique({
            where: { admin_id: adminId },
        });
        const loanAccountIds = await this.getCollectorLoanAccountIds(adminId);
        const { total_handling_fee, total_fines } = await this.calculateTotalAmounts(loanAccountIds);
        const reduced_handling_fee = asset ? Number(asset.reduced_handling_fee || 0) : 0;
        const reduced_fines = asset ? Number(asset.reduced_fines || 0) : 0;
        return {
            id: asset?.id || 0,
            admin_id: adminId,
            admin,
            remaining_handling_fee: total_handling_fee - reduced_handling_fee,
            remaining_fines: total_fines - reduced_fines,
            reduced_handling_fee,
            reduced_fines,
        };
    }
    async findAllCollectorAssets() {
        const collectors = await this.prisma.admin.findMany({
            where: { role: 'COLLECTOR' },
            select: { id: true },
        });
        return Promise.all(collectors.map(c => this.findCollectorAsset(c.id)));
    }
    async findRiskControllerAsset(adminId) {
        const admin = await this.prisma.admin.findUnique({
            where: { id: adminId },
            select: { id: true, nickname: true },
        });
        const asset = await this.prisma.riskControllerAssetManagement.findUnique({
            where: { admin_id: adminId },
        });
        const roles = await this.prisma.loanAccountRole.findMany({
            where: { admin_id: adminId, role_type: 'risk_controller' },
            select: { loan_account_id: true },
        });
        const loanAccountIds = roles.map((r) => r.loan_account_id);
        let total_amount = 0;
        if (loanAccountIds.length > 0) {
            const allLoanAccounts = await this.prisma.loanAccount.findMany({
                where: { id: { in: loanAccountIds } },
                select: { handling_fee: true, receiving_amount: true, company_cost: true },
            });
            total_amount = allLoanAccounts.reduce((sum, acc) => sum + Number(acc.handling_fee || 0) + Number(acc.receiving_amount || 0) - Number(acc.company_cost || 0), 0);
        }
        const reduced_amount = asset ? Number(asset.reduced_amount || 0) : 0;
        return {
            id: asset?.id || 0,
            admin_id: adminId,
            admin,
            remaining_amount: total_amount - reduced_amount,
            reduced_amount,
        };
    }
    async findAllRiskControllerAssets() {
        const riskControllers = await this.prisma.admin.findMany({
            where: { role: 'RISK_CONTROLLER' },
            select: { id: true },
        });
        return Promise.all(riskControllers.map(rc => this.findRiskControllerAsset(rc.id)));
    }
    async updateCollectorAsset(adminId, dto) {
        await this.prisma.collectorAssetManagement.upsert({
            where: { admin_id: adminId },
            update: {},
            create: { admin_id: adminId },
        });
        return this.prisma.collectorAssetManagement.update({
            where: { admin_id: adminId },
            data: {
                reduced_handling_fee: dto.reduced_handling_fee,
                reduced_fines: dto.reduced_fines,
            },
        });
    }
    async updateRiskControllerAsset(adminId, dto) {
        await this.prisma.riskControllerAssetManagement.upsert({
            where: { admin_id: adminId },
            update: {},
            create: { admin_id: adminId },
        });
        return this.prisma.riskControllerAssetManagement.update({
            where: { admin_id: adminId },
            data: {
                reduced_amount: dto.reduced_amount,
            },
        });
    }
    async updateCollectorAssetFromLoanAccount(adminId, _loanAccount) {
        const loanAccountIds = await this.getCollectorLoanAccountIds(adminId);
        const { total_handling_fee, total_fines } = await this.calculateTotalAmounts(loanAccountIds);
        await this.prisma.collectorAssetManagement.upsert({
            where: { admin_id: adminId },
            update: {
                total_handling_fee,
                total_fines,
            },
            create: {
                admin_id: adminId,
                total_handling_fee,
                total_fines,
            },
        });
    }
    async updateRiskControllerAssetFromLoanAccount(adminId, _loanAccount) {
        const roles = await this.prisma.loanAccountRole.findMany({
            where: {
                admin_id: adminId,
                role_type: 'risk_controller',
            },
            select: {
                loan_account_id: true,
            },
        });
        const loanAccountIds = roles.map((r) => r.loan_account_id);
        let total_amount = 0;
        if (loanAccountIds.length > 0) {
            const allLoanAccounts = await this.prisma.loanAccount.findMany({
                where: {
                    id: { in: loanAccountIds },
                },
                select: {
                    handling_fee: true,
                    receiving_amount: true,
                    company_cost: true,
                },
            });
            total_amount = allLoanAccounts.reduce((sum, acc) => sum +
                Number(acc.handling_fee || 0) +
                Number(acc.receiving_amount || 0) -
                Number(acc.company_cost || 0), 0);
        }
        await this.prisma.riskControllerAssetManagement.upsert({
            where: { admin_id: adminId },
            update: { total_amount },
            create: {
                admin_id: adminId,
                total_amount,
            },
        });
    }
    async getCollectorLoanAccountIds(adminId) {
        const roles = await this.prisma.loanAccountRole.findMany({
            where: { admin_id: adminId, role_type: 'collector' },
            select: { loan_account_id: true },
        });
        return roles.map((r) => r.loan_account_id);
    }
    async calculateTotalAmounts(loanAccountIds) {
        if (loanAccountIds.length === 0)
            return { total_handling_fee: 0, total_fines: 0 };
        const accounts = await this.prisma.loanAccount.findMany({
            where: { id: { in: loanAccountIds } },
            select: { handling_fee: true, total_fines: true },
        });
        return {
            total_handling_fee: accounts.reduce((sum, a) => sum + Number(a.handling_fee || 0), 0),
            total_fines: accounts.reduce((sum, a) => sum + Number(a.total_fines || 0), 0),
        };
    }
};
exports.AssetManagementService = AssetManagementService;
exports.AssetManagementService = AssetManagementService = AssetManagementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AssetManagementService);
//# sourceMappingURL=asset-management.service.js.map