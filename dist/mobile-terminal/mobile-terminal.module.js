"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileTerminalModule = void 0;
const common_1 = require("@nestjs/common");
const mobile_terminal_service_1 = require("./mobile-terminal.service");
const mobile_terminal_controller_1 = require("./mobile-terminal.controller");
const repayment_records_module_1 = require("../repayment-records/repayment-records.module");
let MobileTerminalModule = class MobileTerminalModule {
};
exports.MobileTerminalModule = MobileTerminalModule;
exports.MobileTerminalModule = MobileTerminalModule = __decorate([
    (0, common_1.Module)({
        imports: [repayment_records_module_1.RepaymentRecordsModule],
        controllers: [mobile_terminal_controller_1.MobileTerminalController],
        providers: [mobile_terminal_service_1.MobileTerminalService],
    })
], MobileTerminalModule);
//# sourceMappingURL=mobile-terminal.module.js.map