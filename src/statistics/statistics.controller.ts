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
    query: GetStatisticsDto & {
      adminId?: string;
    },
    @CurrentUser() user: { id: number },
  ) {
    const targetAdminId = query.adminId
      ? parseInt(query.adminId, 10)
      : undefined;
    const statistics = await this.statisticsService.getScopedStatistics(
      user.id,
      targetAdminId,
    );
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
