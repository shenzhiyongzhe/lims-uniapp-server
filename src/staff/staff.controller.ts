import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { PinService } from '../auth/pin.service';

@Controller('staffs')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ManagementRoles.SUPER_ADMIN)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly pinService: PinService,
  ) {}

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
    const updated = await this.staffService.updateStaff(parseInt(id, 10), body);
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

  @Post('migrate')
  async migrateData(
    @Body('fromStaffId') fromStaffId: number,
    @Body('toStaffId') toStaffId: number,
  ): Promise<ApiResponseDto> {
    const result = await this.staffService.migrateStaffData(
      fromStaffId,
      toStaffId,
    );
    return ResponseHelper.success(result, '数据迁移成功');
  }

  /** 管理员开启/关闭全局密码锁 */
  @Put('pin/global')
  async toggleGlobalPin(
    @Body('enabled') enabled: boolean,
  ): Promise<ApiResponseDto> {
    const result = await this.pinService.toggleGlobalPin(enabled);
    return ResponseHelper.success(
      result,
      enabled ? '已开启全局密码锁' : '已关闭全局密码锁',
    );
  }

  /** 管理员重置指定用户的密码为默认密码 1234 */
  @Put(':id/pin/reset')
  async resetStaffPin(
    @Param('id') id: string,
  ): Promise<ApiResponseDto> {
    const result = await this.pinService.resetStaffPin(parseInt(id, 10));
    return ResponseHelper.success(result, '密码重置成功，该用户密码已重置为 1234');
  }

  /** 管理员解除指定用户的密码锁定状态 */
  @Put(':id/pin/unlock')
  async unlockStaffPin(
    @Param('id') id: string,
  ): Promise<ApiResponseDto> {
    const result = await this.pinService.unlockStaffPin(parseInt(id, 10));
    return ResponseHelper.success(result, '密码锁定已解除');
  }
}
