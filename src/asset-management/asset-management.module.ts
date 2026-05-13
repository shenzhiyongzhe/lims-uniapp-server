import { Module } from '@nestjs/common';
import { AssetManagementService } from './asset-management.service';
import { AssetManagementController } from './asset-management.controller';

@Module({
  controllers: [AssetManagementController],
  providers: [AssetManagementService],
  exports: [AssetManagementService],
})
export class AssetManagementModule {}
