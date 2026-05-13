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
exports.StatisticsController = void 0;
const common_1 = require("@nestjs/common");
const statistics_service_1 = require("./statistics.service");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const response_helper_1 = require("../common/response-helper");
const current_user_decorator_1 = require("../auth/current-user.decorator");
let StatisticsController = class StatisticsController {
    statisticsService;
    constructor(statisticsService) {
        this.statisticsService = statisticsService;
    }
    async getStatistics(query, user) {
        if (user.role === 'ADMIN') {
            const roleType = query.roleType || 'collector';
            const adminId = query.adminId ? parseInt(query.adminId, 10) : undefined;
            const statistics = await this.statisticsService.getCollectorDetailedStatisticsForAdmin(user.id, roleType, undefined, adminId);
            return response_helper_1.ResponseHelper.success(statistics, '统计数据获取成功');
        }
        if (user.role === 'COLLECTOR' || user.role === 'RISK_CONTROLLER') {
            const roleType = user.role === 'COLLECTOR' ? 'collector' : 'risk_controller';
            const riskControllerId = query.riskControllerId ? parseInt(query.riskControllerId, 10) : undefined;
            const collectorId = query.collectorId ? parseInt(query.collectorId, 10) : undefined;
            const statistics = await this.statisticsService.getCollectorDetailedStatisticsForCollector(user.id, roleType, undefined, riskControllerId, collectorId);
            return response_helper_1.ResponseHelper.success(statistics, '统计数据获取成功');
        }
    }
    async getAdminStatistics() {
        const statistics = await this.statisticsService.getAdminStatistics();
        return response_helper_1.ResponseHelper.success(statistics, '管理员统计数据获取成功');
    }
};
exports.StatisticsController = StatisticsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StatisticsController.prototype, "getStatistics", null);
__decorate([
    (0, common_1.Get)('admin'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN, client_1.ManagementRoles.RISK_CONTROLLER, client_1.ManagementRoles.COLLECTOR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatisticsController.prototype, "getAdminStatistics", null);
exports.StatisticsController = StatisticsController = __decorate([
    (0, common_1.Controller)('statistics'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [statistics_service_1.StatisticsService])
], StatisticsController);
//# sourceMappingURL=statistics.controller.js.map