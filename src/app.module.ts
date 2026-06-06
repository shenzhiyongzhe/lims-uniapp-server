import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LoanAccountsModule } from './loanAccounts/loanAccounts.module';
import { StatisticsModule } from './statistics/statistics.module';
import { RepaymentRecordsModule } from './repayment-records/repayment-records.module';
import { AssetManagementModule } from './asset-management/asset-management.module';
import { CollectorStatisticsModule } from './collector-statistics/collector-statistics.module';
import { UsersModule } from './users/users.module';
import { LoanPredictionModule } from './loan-prediction/loan-prediction.module';
import { StaffModule } from './staff/staff.module';
import { RepaymentSchedulesModule } from './repayment-schedules/repayment-schedules.module';
import { ScheduleTasksModule } from './schedule/schedule-tasks.module';
import { ChangelogsModule } from './changelogs/changelogs.module';
import { buildPinoParams } from './logger/pino-params.factory';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildPinoParams(configService),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    LoanAccountsModule,
    StatisticsModule,
    RepaymentRecordsModule,
    AssetManagementModule,
    CollectorStatisticsModule,
    UsersModule,
    LoanPredictionModule,
    StaffModule,
    RepaymentSchedulesModule,
    ScheduleTasksModule,
    ChangelogsModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
