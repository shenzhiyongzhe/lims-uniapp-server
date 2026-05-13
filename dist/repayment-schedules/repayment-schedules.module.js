"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepaymentSchedulesModule = void 0;
const common_1 = require("@nestjs/common");
const repayment_schedules_service_1 = require("./repayment-schedules.service");
const repayment_schedules_controller_1 = require("./repayment-schedules.controller");
const loanAccounts_module_1 = require("../loanAccounts/loanAccounts.module");
let RepaymentSchedulesModule = class RepaymentSchedulesModule {
};
exports.RepaymentSchedulesModule = RepaymentSchedulesModule;
exports.RepaymentSchedulesModule = RepaymentSchedulesModule = __decorate([
    (0, common_1.Module)({
        imports: [loanAccounts_module_1.LoanAccountsModule],
        providers: [repayment_schedules_service_1.RepaymentSchedulesService],
        controllers: [repayment_schedules_controller_1.RepaymentSchedulesController],
        exports: [repayment_schedules_service_1.RepaymentSchedulesService],
    })
], RepaymentSchedulesModule);
//# sourceMappingURL=repayment-schedules.module.js.map