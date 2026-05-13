"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const nestjs_pino_1 = require("nestjs-pino");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const loanAccounts_module_1 = require("./loanAccounts/loanAccounts.module");
const statistics_module_1 = require("./statistics/statistics.module");
const repayment_records_module_1 = require("./repayment-records/repayment-records.module");
const asset_management_module_1 = require("./asset-management/asset-management.module");
const collector_statistics_module_1 = require("./collector-statistics/collector-statistics.module");
const users_module_1 = require("./users/users.module");
const loan_prediction_module_1 = require("./loan-prediction/loan-prediction.module");
const admins_module_1 = require("./admins/admins.module");
const repayment_schedules_module_1 = require("./repayment-schedules/repayment-schedules.module");
const schedule_tasks_module_1 = require("./schedule/schedule-tasks.module");
const pino_params_factory_1 = require("./logger/pino-params.factory");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            nestjs_pino_1.LoggerModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => (0, pino_params_factory_1.buildPinoParams)(configService),
            }),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            loanAccounts_module_1.LoanAccountsModule,
            statistics_module_1.StatisticsModule,
            repayment_records_module_1.RepaymentRecordsModule,
            asset_management_module_1.AssetManagementModule,
            collector_statistics_module_1.CollectorStatisticsModule,
            users_module_1.UsersModule,
            loan_prediction_module_1.LoanPredictionModule,
            admins_module_1.AdminsModule,
            repayment_schedules_module_1.RepaymentSchedulesModule,
            schedule_tasks_module_1.ScheduleTasksModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map