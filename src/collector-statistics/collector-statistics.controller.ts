import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CollectorStatisticsService } from './collector-statistics.service';
import { ResponseHelper } from '../common/response-helper';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { RepaymentRecordsService } from '../repayment-records/repayment-records.service';
import { PaginationQueryDto } from '../repayment-records/dto/pagination-query.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('collector-statistics')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ManagementRoles.ADMIN)
export class CollectorStatisticsController {
  constructor(
    private readonly collectorStatisticsService: CollectorStatisticsService,
    private readonly repaymentRecordsService: RepaymentRecordsService,
  ) {}

  @Get('statistics')
  async getTopStatistics(
    @Query()
    query: {
      targetUserId?: string;
    },
    @CurrentUser() currentUser: { id: number },
  ) {
    const targetUserId = query.targetUserId
      ? parseInt(query.targetUserId, 10)
      : undefined;
    const statistics = await this.collectorStatisticsService.getTopStatistics(
      currentUser.id,
      targetUserId,
    );
    return ResponseHelper.success(statistics, '获取统计数据成功');
  }

  @Get('payees')
  async getCollectorPayeeList() {
    const data = await this.collectorStatisticsService.getCollectorPayeeList();
    return ResponseHelper.success(data, '获取收款人列表成功');
  }

  @Get('repayment-records')
  async getRepaymentRecords(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.repaymentRecordsService.findAllWithPagination(
      query,
      user.id,
    );
    const data = {
      ...result,
      data: result.data.map((r: any) =>
        this.repaymentRecordsService.toResponse(r),
      ),
    };
    return ResponseHelper.success(data, '获取收款记录成功');
  }
}
