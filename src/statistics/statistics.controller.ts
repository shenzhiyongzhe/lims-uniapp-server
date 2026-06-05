import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { GetStatisticsDto } from './dto/get-statistics.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { ResponseHelper } from '../common/response-helper';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('statistics')
@UseGuards(AuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  async getStatistics(
    @Query()
    query: GetStatisticsDto,
    @CurrentUser() currentUser: { id: number },
  ) {
    const collectorId = query.collectorId
      ? parseInt(query.collectorId, 10)
      : undefined;
    const riskControllerId = query.riskControllerId
      ? parseInt(query.riskControllerId, 10)
      : undefined;
    const statistics = (await this.statisticsService.getScopedStatistics(
      currentUser.id,
      collectorId,
      riskControllerId,
    )) as Record<string, unknown>;
    return ResponseHelper.success(statistics, '统计数据获取成功');
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(
    ManagementRoles.ADMIN,
    ManagementRoles.RISK_CONTROLLER,
    ManagementRoles.COLLECTOR,
  )
  async getAdminStatistics() {
    const statistics = await this.statisticsService.getAdminStatistics();
    return ResponseHelper.success(statistics, '管理员统计数据获取成功');
  }
}
