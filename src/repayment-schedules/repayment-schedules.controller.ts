import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RepaymentSchedulesService } from './repayment-schedules.service';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('repayment-schedules')
@UseGuards(AuthGuard, RolesGuard)
export class RepaymentSchedulesController {
  constructor(
    private readonly repaymentSchedulesService: RepaymentSchedulesService,
  ) {}

  @Get(':id/operation-logs')
  async findOperationLogs(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto> {
    const logs = await this.repaymentSchedulesService.findOperationLogs(id);
    return ResponseHelper.success(logs, '获取操作日志成功');
  }

  @Get(':id')
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto> {
    const schedule = await this.repaymentSchedulesService.findById(id);

    if (!schedule) {
      throw new NotFoundException('还款计划不存在');
    }

    const data = this.repaymentSchedulesService.toResponse(schedule);
    return ResponseHelper.success(data, '获取还款计划成功');
  }

  @Post()
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  async create(
    @Body() data: { loan_id: number | string; count?: number | string },
    @CurrentUser() user: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    const loanId = Number(data.loan_id);
    if (!Number.isFinite(loanId)) {
      throw new NotFoundException('缺少或无效的 loan_id 参数');
    }
    const count = data.count ? Number(data.count) : undefined;

    try {
      const createdSchedules = await this.repaymentSchedulesService.create(
        loanId,
        user,
        count,
      );

      const responseData = createdSchedules.map((s) => ({
        id: s.id,
        loan_id: s.loan_id,
        period: s.period,
        due_start_date: s.due_start_date,
        due_amount: s.due_amount,
        capital: s.capital,
        interest: s.interest,
        paid_capital: s.paid_capital,
        paid_interest: s.paid_interest,
        fines: s.fines,
        status: s.status,
        paid_amount: s.paid_amount,
        paid_at: s.paid_at,
      }));

      return ResponseHelper.success(
        responseData,
        `成功创建 ${createdSchedules.length} 期还款计划`,
      );
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        return ResponseHelper.error(error.message, 403);
      }
      throw error;
    }
  }

  @Put()
  async update(
    @Body() data: any,
    @CurrentUser() user: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    try {
      const updatedSchedule = await this.repaymentSchedulesService.update(
        data,
        user,
      );

      const responseData = {
        id: updatedSchedule.id,
        loan_id: updatedSchedule.loan_id,
        period: updatedSchedule.period,
        due_start_date: updatedSchedule.due_start_date,
        due_amount: updatedSchedule.due_amount,
        capital: updatedSchedule.capital,
        interest: updatedSchedule.interest,
        paid_capital: updatedSchedule.paid_capital,
        paid_interest: updatedSchedule.paid_interest,
        fines: updatedSchedule.fines,
        status: updatedSchedule.status,
        paid_amount: updatedSchedule.paid_amount,
        paid_at: updatedSchedule.paid_at,
      };

      return ResponseHelper.success(responseData, '更新还款计划成功');
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        return ResponseHelper.error(error.message, 403);
      }
      throw error;
    }
  }
}
