import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ChangelogsService } from './changelogs.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@Controller('changelogs')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN, ManagementRoles.ADMIN_LIMITED)
export class ChangelogsController {
  constructor(private readonly changelogsService: ChangelogsService) {}

  @Get('recent')
  async recent(@Query('limit') limit?: string): Promise<ApiResponseDto> {
    const items = await this.changelogsService.findRecent(
      limit ? parseInt(limit, 10) : 10,
    );
    return ResponseHelper.success(items, '获取更新日志成功');
  }
}
