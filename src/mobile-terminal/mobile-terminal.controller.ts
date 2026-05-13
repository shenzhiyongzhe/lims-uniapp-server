import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MobileTerminalService } from './mobile-terminal.service';
import { ResponseHelper } from '../common/response-helper';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { RepaymentRecordsService } from '../repayment-records/repayment-records.service';
import { PaginationQueryDto } from '../repayment-records/dto/pagination-query.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('mobile-terminal')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ManagementRoles.ADMIN)
export class MobileTerminalController {
  constructor(
    private readonly mobileTerminalService: MobileTerminalService,
    private readonly repaymentRecordsService: RepaymentRecordsService,
  ) {}

  @Get('statistics')
  async getTopStatistics() {
    const statistics = await this.mobileTerminalService.getTopStatistics();
    return ResponseHelper.success(statistics, '获取统计数据成功');
  }

  @Get('payees')
  async getPayees() {
    const data = await this.mobileTerminalService.getPayees();
    return ResponseHelper.success(data, '获取收款人列表成功');
  }

  @Get('repayment-records')
  async getRepaymentRecords(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.repaymentRecordsService.findAllWithPagination(query, user.id);
    const data = {
      ...result,
      data: result.data.map((r: any) => this.repaymentRecordsService.toResponse(r)),
    };
    return ResponseHelper.success(data, '获取收款记录成功');
  }
}
