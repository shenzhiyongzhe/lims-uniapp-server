import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OverdueSweepService } from './overdue-sweep.service';

@Module({
  imports: [PrismaModule],
  providers: [OverdueSweepService],
})
export class ScheduleTasksModule {}
