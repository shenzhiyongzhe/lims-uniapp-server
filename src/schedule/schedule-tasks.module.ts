import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OverdueSweepService } from './overdue-sweep.service';
import { RepaymentRecordsModule } from '../repayment-records/repayment-records.module';
import { DailyLoanBalanceService } from './daily-loan-balance.service';

@Module({
  imports: [PrismaModule, RepaymentRecordsModule],
  providers: [OverdueSweepService, DailyLoanBalanceService],
})
export class ScheduleTasksModule {}
