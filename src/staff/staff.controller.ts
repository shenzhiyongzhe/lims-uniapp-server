import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Controller('staffs')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ManagementRoles.SUPER_ADMIN)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  async findAll(): Promise<ApiResponseDto> {
    const staffList = await this.staffService.findAll();
    return ResponseHelper.success(staffList, '获取业务人员列表成功');
  }

  @Patch(':id')
  async updateStaff(
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
  ): Promise<ApiResponseDto> {
    const updated = await this.staffService.updateStaff(
      parseInt(id, 10),
      body,
    );
    return ResponseHelper.success(updated, '更新业务人员成功');
  }

  @Put(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body('role') role: ManagementRoles,
  ): Promise<ApiResponseDto> {
    const updated = await this.staffService.updateRole(parseInt(id, 10), role);
    return ResponseHelper.success(updated, '更新角色成功');
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResponseDto> {
    await this.staffService.remove(parseInt(id, 10));
    return ResponseHelper.success(null, '删除业务人员成功');
  }
}
