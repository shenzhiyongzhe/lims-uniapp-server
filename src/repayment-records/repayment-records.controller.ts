import { Controller, Get, Query, UseGuards, Header } from '@nestjs/common';
import { RepaymentRecordsService } from './repayment-records.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ResponseHelper } from '../common/response-helper';
import { CurrentUser } from '../auth/current-user.decorator';
import { CollectorSummaryQueryDto } from './dto/collector-summary-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';

@Controller('repayment-records')
@UseGuards(AuthGuard)
export class RepaymentRecordsController {
  constructor(
    private readonly repaymentRecordsService: RepaymentRecordsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, must-revalidate')
  async findAll(@Query() query: PaginationQueryDto, @CurrentUser() user: any) {
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
    return ResponseHelper.success(data, '获取还款记录成功');
  }

  @Get('collector-summary')
  async getCollectorSummary(
    @Query() query: CollectorSummaryQueryDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.repaymentRecordsService.getScopedRepaymentSummary(
      query,
      user.id,
    );
    return ResponseHelper.success(data, '获取收款统计成功');
  }

  @Get('daily-summary')
  async getDailySummary(
    @Query() query: DailySummaryQueryDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.repaymentRecordsService.getDailySummary(
      query,
      user.id,
    );
    return ResponseHelper.success(data, '获取按日收款统计成功');
  }
}
