import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AssetManagementService } from './asset-management.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { ResponseHelper } from '../common/response-helper';
import { UpdateCollectorAssetDto } from './dto/update-collector-asset.dto';
import { AdjustCollectorDepositDto } from './dto/adjust-collector-deposit.dto';
import { QueryAssetHistoryDto } from './dto/query-asset-history.dto';
import { CreateReductionRecordDto } from './dto/create-reduction-record.dto';
import { QueryReductionRecordsDto } from './dto/query-reduction-records.dto';
import { CurrentUser } from '../auth/current-user.decorator';

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

  @Get('asset-history')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN, ManagementRoles.ADMIN_LIMITED)
  async getAssetHistory(@Query() query: QueryAssetHistoryDto) {
    const data = await this.assetManagementService.findAssetHistory(query);
    return ResponseHelper.success(data, '获取资产变更历史成功');
  }

  /** 查询减资明细：支持 riskControllerId、collectorId、reductionType 过滤 */
  @Get('reduction-records')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN, ManagementRoles.ADMIN_LIMITED)
  async getReductionRecords(@Query() query: QueryReductionRecordsDto) {
    const data = await this.assetManagementService.findReductionRecords(query);
    return ResponseHelper.success(data, '获取减资明细成功');
  }

  @Get('collector/:userId')
  async getCollectorAsset(@Param('userId') userId: string) {
    const data = await this.assetManagementService.findCollectorAsset(
      parseInt(userId, 10),
    );
    return ResponseHelper.success(data, '获取负责人资产成功');
  }

  @Get('risk-controller/:userId')
  async getRiskControllerAsset(@Param('userId') userId: string) {
    const data = await this.assetManagementService.findRiskControllerAsset(
      parseInt(userId, 10),
    );
    return ResponseHelper.success(data, '获取风控人资产成功');
  }

  @Put('collector/:userId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  async updateCollectorAsset(
    @Param('userId') userId: string,
    @Body() dto: UpdateCollectorAssetDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    const data = await this.assetManagementService.updateCollectorAsset(
      parseInt(userId, 10),
      dto,
      operator,
    );
    return ResponseHelper.success(data, '更新负责人资产成功');
  }

  @Put('collector/:userId/deposit')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  async adjustCollectorDeposit(
    @Param('userId') userId: string,
    @Body() dto: AdjustCollectorDepositDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    const data = await this.assetManagementService.adjustCollectorDeposit(
      parseInt(userId, 10),
      dto.delta,
      operator,
      dto.remark,
    );
    return ResponseHelper.success(data, '调整存款成功');
  }

  /**
   * 风控人创建一条对 collector 的减资明细记录
   * POST /asset-management/risk-controller/:userId/reduction
   */
  @Post('risk-controller/:userId/reduction')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  async createReductionRecord(
    @Param('userId') userId: string,
    @Body() dto: CreateReductionRecordDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    const data = await this.assetManagementService.createReductionRecord(
      parseInt(userId, 10),
      dto,
      operator,
    );
    return ResponseHelper.success(data, '创建减资记录成功');
  }
}
