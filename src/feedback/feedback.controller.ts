import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { ResponseHelper } from '../common/response-helper';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { QueryFeedbackDto } from './dto/query-feedback.dto';
import { UpdateFeedbackStatusDto } from './dto/update-feedback-status.dto';
import { FeedbackService } from './feedback.service';

const FEEDBACK_ROLES = [
  ManagementRoles.SUPER_ADMIN,
  ManagementRoles.ADMIN,
  ManagementRoles.ADMIN_LIMITED,
  ManagementRoles.RISK_CONTROLLER,
  ManagementRoles.COLLECTOR,
] as const;

@Controller('feedback')
@UseGuards(AuthGuard, RolesGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Roles(...FEEDBACK_ROLES)
  async create(
    @Body() body: CreateFeedbackDto,
    @CurrentUser() user: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    const created = await this.feedbackService.create(user.id, body);
    return ResponseHelper.success(created, '提交反馈成功');
  }

  @Get()
  @Roles(...FEEDBACK_ROLES)
  async findAll(@Query() query: QueryFeedbackDto): Promise<ApiResponseDto> {
    const result = await this.feedbackService.findAll(query);
    return ResponseHelper.success(result, '获取反馈列表成功');
  }

  @Patch(':id/status')
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateFeedbackStatusDto,
  ): Promise<ApiResponseDto> {
    const updated = await this.feedbackService.updateStatus(id, body.status);
    return ResponseHelper.success(updated, '更新反馈状态成功');
  }
}
