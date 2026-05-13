import { Controller, Get, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@Controller('admins')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ManagementRoles.ADMIN)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  async findAll(): Promise<ApiResponseDto> {
    const admins = await this.adminsService.findAll();
    return ResponseHelper.success(admins, '获取管理员列表成功');
  }

  @Put(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: ManagementRoles,
  ): Promise<ApiResponseDto> {
    const updated = await this.adminsService.updateRole(parseInt(id, 10), role);
    return ResponseHelper.success(updated, '更新角色成功');
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponseDto> {
    await this.adminsService.remove(parseInt(id, 10));
    return ResponseHelper.success(null, '删除管理员成功');
  }
}
