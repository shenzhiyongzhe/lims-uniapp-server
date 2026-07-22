import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffConfigController } from './staff-config.controller';
import { StaffConfigService } from './staff-config.service';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [StaffConfigService],
  controllers: [StaffConfigController],
  exports: [StaffConfigService],
})
export class StaffConfigModule {}
