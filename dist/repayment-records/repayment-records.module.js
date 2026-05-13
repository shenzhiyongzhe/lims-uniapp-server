"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepaymentRecordsModule = void 0;
const common_1 = require("@nestjs/common");
const repayment_records_service_1 = require("./repayment-records.service");
const repayment_records_controller_1 = require("./repayment-records.controller");
let RepaymentRecordsModule = class RepaymentRecordsModule {
};
exports.RepaymentRecordsModule = RepaymentRecordsModule;
exports.RepaymentRecordsModule = RepaymentRecordsModule = __decorate([
    (0, common_1.Module)({
        controllers: [repayment_records_controller_1.RepaymentRecordsController],
        providers: [repayment_records_service_1.RepaymentRecordsService],
        exports: [repayment_records_service_1.RepaymentRecordsService],
    })
], RepaymentRecordsModule);
//# sourceMappingURL=repayment-records.module.js.map