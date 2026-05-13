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
exports.RepaymentRecordsController = void 0;
const common_1 = require("@nestjs/common");
const repayment_records_service_1 = require("./repayment-records.service");
const pagination_query_dto_1 = require("./dto/pagination-query.dto");
const auth_guard_1 = require("../auth/auth.guard");
const response_helper_1 = require("../common/response-helper");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const collector_summary_query_dto_1 = require("./dto/collector-summary-query.dto");
const daily_summary_query_dto_1 = require("./dto/daily-summary-query.dto");
let RepaymentRecordsController = class RepaymentRecordsController {
    repaymentRecordsService;
    constructor(repaymentRecordsService) {
        this.repaymentRecordsService = repaymentRecordsService;
    }
    async findAll(query, user) {
        const result = await this.repaymentRecordsService.findAllWithPagination(query, user.id);
        const data = {
            ...result,
            data: result.data.map((r) => this.repaymentRecordsService.toResponse(r)),
        };
        return response_helper_1.ResponseHelper.success(data, '获取还款记录成功');
    }
    async getCollectorSummary(query, user) {
        const data = await this.repaymentRecordsService.getCollectorSummary(query, user.id);
        return response_helper_1.ResponseHelper.success(data, '获取收款统计成功');
    }
    async getDailySummary(query, user) {
        const data = await this.repaymentRecordsService.getDailySummary(query, user.id);
        return response_helper_1.ResponseHelper.success(data, '获取按日收款统计成功');
    }
};
exports.RepaymentRecordsController = RepaymentRecordsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Cache-Control', 'private, no-store, must-revalidate'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_query_dto_1.PaginationQueryDto, Object]),
    __metadata("design:returntype", Promise)
], RepaymentRecordsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('collector-summary'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [collector_summary_query_dto_1.CollectorSummaryQueryDto, Object]),
    __metadata("design:returntype", Promise)
], RepaymentRecordsController.prototype, "getCollectorSummary", null);
__decorate([
    (0, common_1.Get)('daily-summary'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [daily_summary_query_dto_1.DailySummaryQueryDto, Object]),
    __metadata("design:returntype", Promise)
], RepaymentRecordsController.prototype, "getDailySummary", null);
exports.RepaymentRecordsController = RepaymentRecordsController = __decorate([
    (0, common_1.Controller)('repayment-records'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [repayment_records_service_1.RepaymentRecordsService])
], RepaymentRecordsController);
//# sourceMappingURL=repayment-records.controller.js.map