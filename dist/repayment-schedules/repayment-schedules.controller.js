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
exports.RepaymentSchedulesController = void 0;
const common_1 = require("@nestjs/common");
const repayment_schedules_service_1 = require("./repayment-schedules.service");
const response_helper_1 = require("../common/response-helper");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../auth/current-user.decorator");
let RepaymentSchedulesController = class RepaymentSchedulesController {
    repaymentSchedulesService;
    constructor(repaymentSchedulesService) {
        this.repaymentSchedulesService = repaymentSchedulesService;
    }
    async findOperationLogs(id) {
        const logs = await this.repaymentSchedulesService.findOperationLogs(id);
        return response_helper_1.ResponseHelper.success(logs, '获取操作日志成功');
    }
    async findById(id) {
        const schedule = await this.repaymentSchedulesService.findById(id);
        if (!schedule) {
            throw new common_1.NotFoundException('还款计划不存在');
        }
        const data = this.repaymentSchedulesService.toResponse(schedule);
        return response_helper_1.ResponseHelper.success(data, '获取还款计划成功');
    }
    async create(data) {
        const loanId = Number(data.loan_id);
        if (!Number.isFinite(loanId)) {
            throw new common_1.NotFoundException('缺少或无效的 loan_id 参数');
        }
        const newSchedule = await this.repaymentSchedulesService.create(loanId);
        const responseData = {
            id: newSchedule.id,
            loan_id: newSchedule.loan_id,
            period: newSchedule.period,
            due_start_date: newSchedule.due_start_date,
            due_amount: newSchedule.due_amount,
            capital: newSchedule.capital,
            interest: newSchedule.interest,
            paid_capital: newSchedule.paid_capital,
            paid_interest: newSchedule.paid_interest,
            fines: newSchedule.fines,
            status: newSchedule.status,
            paid_amount: newSchedule.paid_amount,
            paid_at: newSchedule.paid_at,
        };
        return response_helper_1.ResponseHelper.success(responseData, '创建还款计划成功');
    }
    async update(data, user) {
        const updatedSchedule = await this.repaymentSchedulesService.update(data, user?.id);
        const responseData = {
            id: updatedSchedule.id,
            loan_id: updatedSchedule.loan_id,
            period: updatedSchedule.period,
            due_start_date: updatedSchedule.due_start_date,
            due_amount: updatedSchedule.due_amount,
            capital: updatedSchedule.capital,
            interest: updatedSchedule.interest,
            paid_capital: updatedSchedule.paid_capital,
            paid_interest: updatedSchedule.paid_interest,
            fines: updatedSchedule.fines,
            status: updatedSchedule.status,
            paid_amount: updatedSchedule.paid_amount,
            paid_at: updatedSchedule.paid_at,
        };
        return response_helper_1.ResponseHelper.success(responseData, '更新还款计划成功');
    }
};
exports.RepaymentSchedulesController = RepaymentSchedulesController;
__decorate([
    (0, common_1.Get)(':id/operation-logs'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], RepaymentSchedulesController.prototype, "findOperationLogs", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], RepaymentSchedulesController.prototype, "findById", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN, client_1.ManagementRoles.COLLECTOR, client_1.ManagementRoles.RISK_CONTROLLER),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RepaymentSchedulesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RepaymentSchedulesController.prototype, "update", null);
exports.RepaymentSchedulesController = RepaymentSchedulesController = __decorate([
    (0, common_1.Controller)('repayment-schedules'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [repayment_schedules_service_1.RepaymentSchedulesService])
], RepaymentSchedulesController);
//# sourceMappingURL=repayment-schedules.controller.js.map