import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { ResponseHelper } from '../common/response-helper';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { QueryErrorLogDto } from './dto/query-error-log.dto';
import { ErrorLogsService } from './error-logs.service';

const ALL_ROLES = [
  ManagementRoles.SUPER_ADMIN,
  ManagementRoles.ADMIN,
  ManagementRoles.ADMIN_LIMITED,
  ManagementRoles.RISK_CONTROLLER,
  ManagementRoles.COLLECTOR,
] as const;

@Controller('error-logs')
@UseGuards(AuthGuard, RolesGuard)
export class ErrorLogsController {
  constructor(private readonly errorLogsService: ErrorLogsService) {}

  @Post()
  @Roles(...ALL_ROLES)
  async create(
    @Body() body: CreateErrorLogDto,
    @CurrentUser() user: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    const created = await this.errorLogsService.create(user ? user.id : null, body);
    return ResponseHelper.success(created, '上报日志成功');
  }

  @Get()
  @Roles(...ALL_ROLES)
  async findAll(@Query() query: QueryErrorLogDto): Promise<ApiResponseDto> {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 50;
    const result = await this.errorLogsService.findAll(page, pageSize);
    return ResponseHelper.success(result, '获取错误日志成功');
  }

  @Delete()
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  async clearAll(): Promise<ApiResponseDto> {
    await this.errorLogsService.clearAll();
    return ResponseHelper.success(null, '清空错误日志成功');
  }
}
