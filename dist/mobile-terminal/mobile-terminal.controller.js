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
exports.MobileTerminalController = void 0;
const common_1 = require("@nestjs/common");
const mobile_terminal_service_1 = require("./mobile-terminal.service");
const response_helper_1 = require("../common/response-helper");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const repayment_records_service_1 = require("../repayment-records/repayment-records.service");
const pagination_query_dto_1 = require("../repayment-records/dto/pagination-query.dto");
const current_user_decorator_1 = require("../auth/current-user.decorator");
let MobileTerminalController = class MobileTerminalController {
    mobileTerminalService;
    repaymentRecordsService;
    constructor(mobileTerminalService, repaymentRecordsService) {
        this.mobileTerminalService = mobileTerminalService;
        this.repaymentRecordsService = repaymentRecordsService;
    }
    async getTopStatistics() {
        const statistics = await this.mobileTerminalService.getTopStatistics();
        return response_helper_1.ResponseHelper.success(statistics, '获取统计数据成功');
    }
    async getPayees() {
        const data = await this.mobileTerminalService.getPayees();
        return response_helper_1.ResponseHelper.success(data, '获取收款人列表成功');
    }
    async getRepaymentRecords(query, user) {
        const result = await this.repaymentRecordsService.findAllWithPagination(query, user.id);
        const data = {
            ...result,
            data: result.data.map((r) => this.repaymentRecordsService.toResponse(r)),
        };
        return response_helper_1.ResponseHelper.success(data, '获取收款记录成功');
    }
};
exports.MobileTerminalController = MobileTerminalController;
__decorate([
    (0, common_1.Get)('statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MobileTerminalController.prototype, "getTopStatistics", null);
__decorate([
    (0, common_1.Get)('payees'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MobileTerminalController.prototype, "getPayees", null);
__decorate([
    (0, common_1.Get)('repayment-records'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_query_dto_1.PaginationQueryDto, Object]),
    __metadata("design:returntype", Promise)
], MobileTerminalController.prototype, "getRepaymentRecords", null);
exports.MobileTerminalController = MobileTerminalController = __decorate([
    (0, common_1.Controller)('mobile-terminal'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN),
    __metadata("design:paramtypes", [mobile_terminal_service_1.MobileTerminalService,
        repayment_records_service_1.RepaymentRecordsService])
], MobileTerminalController);
//# sourceMappingURL=mobile-terminal.controller.js.map