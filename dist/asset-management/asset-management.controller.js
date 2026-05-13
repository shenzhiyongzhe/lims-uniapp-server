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
exports.AssetManagementController = void 0;
const common_1 = require("@nestjs/common");
const asset_management_service_1 = require("./asset-management.service");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const response_helper_1 = require("../common/response-helper");
const update_collector_asset_dto_1 = require("./dto/update-collector-asset.dto");
const update_risk_controller_asset_dto_1 = require("./dto/update-risk-controller-asset.dto");
let AssetManagementController = class AssetManagementController {
    assetManagementService;
    constructor(assetManagementService) {
        this.assetManagementService = assetManagementService;
    }
    async getAllCollectorAssets() {
        const data = await this.assetManagementService.findAllCollectorAssets();
        return response_helper_1.ResponseHelper.success(data, '获取所有负责人资产成功');
    }
    async getAllRiskControllerAssets() {
        const data = await this.assetManagementService.findAllRiskControllerAssets();
        return response_helper_1.ResponseHelper.success(data, '获取所有风控人资产成功');
    }
    async getCollectorAsset(adminId) {
        const data = await this.assetManagementService.findCollectorAsset(parseInt(adminId, 10));
        return response_helper_1.ResponseHelper.success(data, '获取负责人资产成功');
    }
    async getRiskControllerAsset(adminId) {
        const data = await this.assetManagementService.findRiskControllerAsset(parseInt(adminId, 10));
        return response_helper_1.ResponseHelper.success(data, '获取风控人资产成功');
    }
    async updateCollectorAsset(adminId, dto) {
        const data = await this.assetManagementService.updateCollectorAsset(parseInt(adminId, 10), dto);
        return response_helper_1.ResponseHelper.success(data, '更新负责人资产成功');
    }
    async updateRiskControllerAsset(adminId, dto) {
        const data = await this.assetManagementService.updateRiskControllerAsset(parseInt(adminId, 10), dto);
        return response_helper_1.ResponseHelper.success(data, '更新风控人资产成功');
    }
};
exports.AssetManagementController = AssetManagementController;
__decorate([
    (0, common_1.Get)('collector'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AssetManagementController.prototype, "getAllCollectorAssets", null);
__decorate([
    (0, common_1.Get)('risk-controller'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AssetManagementController.prototype, "getAllRiskControllerAssets", null);
__decorate([
    (0, common_1.Get)('collector/:adminId'),
    __param(0, (0, common_1.Param)('adminId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AssetManagementController.prototype, "getCollectorAsset", null);
__decorate([
    (0, common_1.Get)('risk-controller/:adminId'),
    __param(0, (0, common_1.Param)('adminId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AssetManagementController.prototype, "getRiskControllerAsset", null);
__decorate([
    (0, common_1.Put)('collector/:adminId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN),
    __param(0, (0, common_1.Param)('adminId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_collector_asset_dto_1.UpdateCollectorAssetDto]),
    __metadata("design:returntype", Promise)
], AssetManagementController.prototype, "updateCollectorAsset", null);
__decorate([
    (0, common_1.Put)('risk-controller/:adminId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.ManagementRoles.ADMIN),
    __param(0, (0, common_1.Param)('adminId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_risk_controller_asset_dto_1.UpdateRiskControllerAssetDto]),
    __metadata("design:returntype", Promise)
], AssetManagementController.prototype, "updateRiskControllerAsset", null);
exports.AssetManagementController = AssetManagementController = __decorate([
    (0, common_1.Controller)('asset-management'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [asset_management_service_1.AssetManagementService])
], AssetManagementController);
//# sourceMappingURL=asset-management.controller.js.map