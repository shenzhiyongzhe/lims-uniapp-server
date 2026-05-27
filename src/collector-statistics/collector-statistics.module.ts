import { Module } from '@nestjs/common';
import { CollectorStatisticsService } from './collector-statistics.service';
import { CollectorStatisticsController } from './collector-statistics.controller';
import { RepaymentRecordsModule } from '../repayment-records/repayment-records.module';
import { AccessScopeModule } from '../access-scope/access-scope.module';

@Module({
  imports: [RepaymentRecordsModule, AccessScopeModule],
  controllers: [CollectorStatisticsController],
  providers: [CollectorStatisticsService],
})
export class CollectorStatisticsModule {}
