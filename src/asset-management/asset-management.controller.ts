import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AssetManagementService } from './asset-management.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { ResponseHelper } from '../common/response-helper';
import { UpdateCollectorAssetDto } from './dto/update-collector-asset.dto';
import { UpdateRiskControllerAssetDto } from './dto/update-risk-controller-asset.dto';

@Controller('asset-management')
@UseGuards(AuthGuard)
export class AssetManagementController {
  constructor(
    private readonly assetManagementService: AssetManagementService,
  ) {}

  @Get('collector')
  async getAllCollectorAssets() {
    const data = await this.assetManagementService.findAllCollectorAssets();
    return ResponseHelper.success(data, '获取所有负责人资产成功');
  }

  @Get('risk-controller')
  async getAllRiskControllerAssets() {
    const data =
      await this.assetManagementService.findAllRiskControllerAssets();
    return ResponseHelper.success(data, '获取所有风控人资产成功');
  }

  @Get('collector/:adminId')
  async getCollectorAsset(@Param('adminId') adminId: string) {
    const data = await this.assetManagementService.findCollectorAsset(
      parseInt(adminId, 10),
    );
    return ResponseHelper.success(data, '获取负责人资产成功');
  }

  @Get('risk-controller/:adminId')
  async getRiskControllerAsset(@Param('adminId') adminId: string) {
    const data = await this.assetManagementService.findRiskControllerAsset(
      parseInt(adminId, 10),
    );
    return ResponseHelper.success(data, '获取风控人资产成功');
  }

  @Put('collector/:adminId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.ADMIN)
  async updateCollectorAsset(
    @Param('adminId') adminId: string,
    @Body() dto: UpdateCollectorAssetDto,
  ) {
    const data = await this.assetManagementService.updateCollectorAsset(
      parseInt(adminId, 10),
      dto,
    );
    return ResponseHelper.success(data, '更新负责人资产成功');
  }

  @Put('risk-controller/:adminId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.ADMIN)
  async updateRiskControllerAsset(
    @Param('adminId') adminId: string,
    @Body() dto: UpdateRiskControllerAssetDto,
  ) {
    const data = await this.assetManagementService.updateRiskControllerAsset(
      parseInt(adminId, 10),
      dto,
    );
    return ResponseHelper.success(data, '更新风控人资产成功');
  }
}
