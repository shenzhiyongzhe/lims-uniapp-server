import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OverdueSweepService } from './overdue-sweep.service';
import { RepaymentRecordsModule } from '../repayment-records/repayment-records.module';
import { DailyLoanBalanceService } from './daily-loan-balance.service';
import { LoanSettledRelockService } from './loan-settled-relock.service';
import { LoanAccountsModule } from '../loanAccounts/loanAccounts.module';

@Module({
  imports: [PrismaModule, RepaymentRecordsModule, LoanAccountsModule],
  providers: [
    OverdueSweepService,
    DailyLoanBalanceService,
    LoanSettledRelockService,
  ],
})
export class ScheduleTasksModule {}
