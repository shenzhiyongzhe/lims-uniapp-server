import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { TransferCollectorDepositDto } from './dto/transfer-collector-deposit.dto';
import { QueryAssetHistoryDto } from './dto/query-asset-history.dto';
import { CreateReductionRecordDto } from './dto/create-reduction-record.dto';
import { QueryReductionRecordsDto } from './dto/query-reduction-records.dto';
import { QueryReductionDailySummaryDto } from './dto/query-reduction-daily-summary.dto';
import { QueryReductionCounterpartySummaryDto } from './dto/query-reduction-counterparty-summary.dto';
import { QueryDepositDailySummaryDto } from './dto/query-deposit-daily-summary.dto';
import { QueryDepositRecordsDto } from './dto/query-deposit-records.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminAdjustDto } from './dto/admin-adjust.dto';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

class QueryPageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

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
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  async getAssetHistory(
    @Query() query: QueryAssetHistoryDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    if (operator.role === 'COLLECTOR' || operator.role === 'RISK_CONTROLLER') {
      query.adminId = operator.id;
      query.assetType =
        operator.role === 'COLLECTOR' ? 'collector' : 'risk_controller';
    }
    const data = await this.assetManagementService.findAssetHistory(query);
    return ResponseHelper.success(data, '获取资产变更历史成功');
  }

  /** 减资按日汇总（日历金额） */
  @Get('reduction-records/daily-summary')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  async getReductionDailySummary(
    @Query() query: QueryReductionDailySummaryDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    if (operator.role === 'COLLECTOR') {
      query.collectorId = operator.id;
    } else if (operator.role === 'RISK_CONTROLLER') {
      query.riskControllerId = operator.id;
    }
    const data =
      await this.assetManagementService.findReductionDailySummary(query);
    return ResponseHelper.success(data, '获取减资按日汇总成功');
  }

  /** 减资关联人员汇总（下拉列表） */
  @Get('reduction-records/counterparty-summary')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  async getReductionCounterpartySummary(
    @Query() query: QueryReductionCounterpartySummaryDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    if (operator.role === 'COLLECTOR') {
      query.perspective = 'collector' as any;
      query.adminId = operator.id;
    } else if (operator.role === 'RISK_CONTROLLER') {
      query.perspective = 'risk_controller' as any;
      query.adminId = operator.id;
    }
    const data =
      await this.assetManagementService.findReductionCounterpartySummary(query);
    return ResponseHelper.success(data, '获取减资关联人员汇总成功');
  }

  /** 查询减资明细：支持 riskControllerId、collectorId、reductionType、date 过滤 */
  @Get('reduction-records')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  async getReductionRecords(
    @Query() query: QueryReductionRecordsDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    if (operator.role === 'COLLECTOR') {
      query.collectorId = operator.id;
    } else if (operator.role === 'RISK_CONTROLLER') {
      query.riskControllerId = operator.id;
    }
    const data = await this.assetManagementService.findReductionRecords(query);
    return ResponseHelper.success(data, '获取减资明细成功');
  }

  /** 撤销今日减资记录：删除原记录，避免流水页出现反向记录 */
  @Delete('reduction-records/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  async deleteReductionRecord(@Param('id') id: string) {
    const data = await this.assetManagementService.deleteReductionRecord(
      parseInt(id, 10),
    );
    return ResponseHelper.success(data, '撤销减资记录成功');
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

  /** 存出款按日汇总（日历金额） */
  @Get('collector/:userId/deposit/daily-summary')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
    ManagementRoles.COLLECTOR,
  )
  async getDepositDailySummary(
    @Param('userId') userId: string,
    @Query() query: QueryDepositDailySummaryDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    if (operator.role === 'COLLECTOR' && parseInt(userId, 10) !== operator.id) {
      throw new ForbiddenException('您无权查看其他人的存出款汇总');
    }
    const data = await this.assetManagementService.findDepositDailySummary(
      parseInt(userId, 10),
      query,
    );
    return ResponseHelper.success(data, '获取存出款按日汇总成功');
  }

  /** 存出款明细 */
  @Get('collector/:userId/deposit/records')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
    ManagementRoles.COLLECTOR,
  )
  async getDepositRecords(
    @Param('userId') userId: string,
    @Query() query: QueryDepositRecordsDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    if (operator.role === 'COLLECTOR' && parseInt(userId, 10) !== operator.id) {
      throw new ForbiddenException('您无权查看其他人的存出款明细');
    }
    const data = await this.assetManagementService.findDepositRecords(
      parseInt(userId, 10),
      query,
    );
    return ResponseHelper.success(data, '获取存出款明细成功');
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

  @Put('collector/:userId/transfer')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  async transferCollectorDeposit(
    @Param('userId') userId: string,
    @Body() dto: TransferCollectorDepositDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    const data = await this.assetManagementService.transferCollectorDeposit(
      parseInt(userId, 10),
      dto.amount,
      operator,
      dto.remark,
    );
    return ResponseHelper.success(data, '划账成功');
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

  /** 获取管理员增减总额 */
  @Get('admin-adjustment')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
  )
  async getAdminAdjustTotal() {
    const data = await this.assetManagementService.getAdminAdjustTotal();
    return ResponseHelper.success(data, '获取管理员增减成功');
  }

  /** 管理员增减操作 */
  @Put('admin-adjustment')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  async adminAdjust(
    @Body() dto: AdminAdjustDto,
    @CurrentUser() operator: { id: number; role: string },
  ) {
    const data = await this.assetManagementService.adminAdjust(
      dto.delta,
      operator,
      dto.remark,
    );
    return ResponseHelper.success(data, '管理员增减成功');
  }

  /** 管理员增减历史记录 */
  @Get('admin-adjustment-history')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
  )
  async getAdminAdjustHistory(@Query() query: QueryPageDto) {
    const data = await this.assetManagementService.getAdminAdjustHistory(
      query.page ?? 1,
      query.pageSize ?? 100,
    );
    return ResponseHelper.success(data, '获取管理员增减历史成功');
  }
}
