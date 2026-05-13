import { Module } from '@nestjs/common';
import { RepaymentRecordsService } from './repayment-records.service';
import { RepaymentRecordsController } from './repayment-records.controller';

@Module({
  controllers: [RepaymentRecordsController],
  providers: [RepaymentRecordsService],
  exports: [RepaymentRecordsService],
})
export class RepaymentRecordsModule {}
