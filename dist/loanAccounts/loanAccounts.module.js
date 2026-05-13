"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanAccountsModule = void 0;
const common_1 = require("@nestjs/common");
const loanAccounts_controller_1 = require("./loanAccounts.controller");
const loanAccounts_service_1 = require("./loanAccounts.service");
const prisma_module_1 = require("../prisma/prisma.module");
const auth_module_1 = require("../auth/auth.module");
const loan_prediction_module_1 = require("../loan-prediction/loan-prediction.module");
const asset_management_module_1 = require("../asset-management/asset-management.module");
let LoanAccountsModule = class LoanAccountsModule {
};
exports.LoanAccountsModule = LoanAccountsModule;
exports.LoanAccountsModule = LoanAccountsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, auth_module_1.AuthModule, loan_prediction_module_1.LoanPredictionModule, asset_management_module_1.AssetManagementModule],
        controllers: [loanAccounts_controller_1.LoanAccountsController],
        providers: [loanAccounts_service_1.LoanAccountsService],
    })
], LoanAccountsModule);
//# sourceMappingURL=loanAccounts.module.js.map