import { Module } from '@nestjs/common';
import { RepaymentRecordsService } from './repayment-records.service';
import { RepaymentRecordsController } from './repayment-records.controller';
import { AccessScopeModule } from '../access-scope/access-scope.module';

@Module({
  imports: [AccessScopeModule],
  controllers: [RepaymentRecordsController],
  providers: [RepaymentRecordsService],
  exports: [RepaymentRecordsService],
})
export class RepaymentRecordsModule {}
