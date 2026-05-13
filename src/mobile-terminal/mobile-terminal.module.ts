import { Module } from '@nestjs/common';
import { MobileTerminalService } from './mobile-terminal.service';
import { MobileTerminalController } from './mobile-terminal.controller';
import { RepaymentRecordsModule } from '../repayment-records/repayment-records.module';

@Module({
  imports: [RepaymentRecordsModule],
  controllers: [MobileTerminalController],
  providers: [MobileTerminalService],
})
export class MobileTerminalModule {}
