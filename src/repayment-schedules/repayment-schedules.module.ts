import { Module } from '@nestjs/common';
import { RepaymentSchedulesService } from './repayment-schedules.service';
import { RepaymentSchedulesController } from './repayment-schedules.controller';
import { LoanAccountsModule } from '../loanAccounts/loanAccounts.module';

@Module({
  imports: [LoanAccountsModule],
  providers: [RepaymentSchedulesService],
  controllers: [RepaymentSchedulesController],
  exports: [RepaymentSchedulesService],
})
export class RepaymentSchedulesModule {}
