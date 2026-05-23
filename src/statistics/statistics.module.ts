import { Module } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { AccessScopeModule } from '../access-scope/access-scope.module';

@Module({
  imports: [AccessScopeModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
