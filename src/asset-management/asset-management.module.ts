import { Module } from '@nestjs/common';
import { AssetManagementService } from './asset-management.service';
import { AssetManagementController } from './asset-management.controller';
import { AccessScopeModule } from '../access-scope/access-scope.module';

@Module({
  imports: [AccessScopeModule],
  controllers: [AssetManagementController],
  providers: [AssetManagementService],
  exports: [AssetManagementService],
})
export class AssetManagementModule {}
