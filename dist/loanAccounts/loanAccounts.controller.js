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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanAccountsController = void 0;
const common_1 = require("@nestjs/common");
const loanAccounts_service_1 = require("./loanAccounts.service");
const create_loanAccount_dto_1 = require("./dto/create-loanAccount.dto");
const update_loanAccount_dto_1 = require("./dto/update-loanAccount.dto");
const update_loan_account_status_dto_1 = require("./dto/update-loan-account-status.dto");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const response_helper_1 = require("../common/response-helper");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
let LoanAccountsController = class LoanAccountsController {
    loanAccountsService;
    constructor(loanAccountsService) {
        this.loanAccountsService = loanAccountsService;
    }
    async findAll() {
        const loans = await this.loanAccountsService.findAll();
        return response_helper_1.ResponseHelper.success(loans, '获取贷款记录成功');
    }
    async findRelatedAdmins() {
        const admins = await this.loanAccountsService.findRelatedAdmins();
        return response_helper_1.ResponseHelper.success(admins, '获取相关管理员成功');
    }
    async findGroupedByUser(page, pageSize, status, adminId, keyword, username, listFilter, user) {
        const result = await this.loanAccountsService.findGroupedByUser({
            page: parseInt(page, 10) || 1,
            pageSize: parseInt(pageSize, 10) || 20,
            status,
            adminId,
            keyword,
            username,
            listFilter,
        }, user);
        return response_helper_1.ResponseHelper.success(result, '获取贷款记录成功');
    }
    async getListStats(adminId, username, listFilter, status, keyword, user) {
        const result = await this.loanAccountsService.findListStats({ adminId, username, listFilter, status, keyword }, user);
        return response_helper_1.ResponseHelper.success(result, '获取统计数据成功');
    }
    async findById(id) {
        const loan = await this.loanAccountsService.findById(id);
        if (!loan) {
            return response_helper_1.ResponseHelper.error('贷款记录不存在', 400);
        }
        return response_helper_1.ResponseHelper.success(loan, '获取贷款记录成功');
    }
    async create(body, user) {
        try {
            const loan = await this.loanAccountsService.create(body, user.id);
            return response_helper_1.ResponseHelper.success(loan, '创建贷款记录成功');
        }
        catch (error) {
            return response_helper_1.ResponseHelper.error(`创建贷款记录失败: ${error.message}`, 500);
        }
    }
    async updateStatus(id, body) {
        try {
            await this.loanAccountsService.updateAccountStatus(id, body);
            const loan = await this.loanAccountsService.findById(id);
            return response_helper_1.ResponseHelper.success(loan, '更新贷款状态成功');
        }
        catch (error) {
            return response_helper_1.ResponseHelper.error(`更新贷款状态失败: ${error.message}`, 500);
        }
    }
    async update(id, body) {
        try {
            const updated = await this.loanAccountsService.update(id, body);
            return response_helper_1.ResponseHelper.success(updated, '更新贷款记录成功');
        }
        catch (error) {
            return response_helper_1.ResponseHelper.error(`更新贷款记录失败: ${error.message}`, 500);
        }
    }
    async remove(id) {
        try {
            await this.loanAccountsService.remove(id);
            return response_helper_1.ResponseHelper.success(null, '删除贷款记录成功');
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                return response_helper_1.ResponseHelper.error(error.message, 404);
            }
            return response_helper_1.ResponseHelper.error(`删除贷款记录失败: ${error.message}`, 500);
        }
    }
};
exports.LoanAccountsController = LoanAccountsController;
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LoanAccountsController.prototype, "findAll", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)('related-admins'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LoanAccountsController.prototype, "findRelatedAdmins", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)('grouped-by-user'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('adminId')),
    __param(4, (0, common_1.Query)('keyword')),
    __param(5, (0, common_1.Query)('username')),
    __param(6, (0, common_1.Query)('listFilter')),
    __param(7, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], LoanAccountsController.prototype, "findGroupedByUser", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)('list-stats'),
    __param(0, (0, common_1.Query)('adminId')),
    __param(1, (0, common_1.Query)('username')),
    __param(2, (0, common_1.Query)('listFilter')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('keyword')),
    __param(5, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], LoanAccountsController.prototype, "getListStats", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], LoanAccountsController.prototype, "findById", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN, client_1.ManagementRoles.RISK_CONTROLLER),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_loanAccount_dto_1.CreateLoanAccountDto, Object]),
    __metadata("design:returntype", Promise)
], LoanAccountsController.prototype, "create", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN, client_1.ManagementRoles.COLLECTOR, client_1.ManagementRoles.RISK_CONTROLLER),
    (0, common_1.Put)(':id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_loan_account_status_dto_1.UpdateLoanAccountStatusDto]),
    __metadata("design:returntype", Promise)
], LoanAccountsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN, client_1.ManagementRoles.COLLECTOR, client_1.ManagementRoles.RISK_CONTROLLER),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_loanAccount_dto_1.UpdateLoanAccountDto]),
    __metadata("design:returntype", Promise)
], LoanAccountsController.prototype, "update", null);
__decorate([
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], LoanAccountsController.prototype, "remove", null);
exports.LoanAccountsController = LoanAccountsController = __decorate([
    (0, common_1.Controller)('loan-accounts'),
    __metadata("design:paramtypes", [loanAccounts_service_1.LoanAccountsService])
], LoanAccountsController);
//# sourceMappingURL=loanAccounts.controller.js.map