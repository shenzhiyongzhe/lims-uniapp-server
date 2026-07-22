import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { ResponseHelper } from '../common/response-helper';
import { PinLoanDto } from './dto/pin-loan.dto';
import { UpsertStaffConfigDto } from './dto/upsert-staff-config.dto';
import { LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY } from './staff-config.constants';
import { StaffConfigService } from './staff-config.service';

const STAFF_CONFIG_ROLES = [
  ManagementRoles.SUPER_ADMIN,
  ManagementRoles.ADMIN,
  ManagementRoles.ADMIN_LIMITED,
  ManagementRoles.RISK_CONTROLLER,
  ManagementRoles.COLLECTOR,
] as const;

@Controller('staff-configs')
@UseGuards(AuthGuard, RolesGuard)
@Roles(...STAFF_CONFIG_ROLES)
export class StaffConfigController {
  constructor(private readonly staffConfigService: StaffConfigService) {}

  @Post(`${LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY}/pin`)
  async pinLoan(
    @Body() body: PinLoanDto,
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    const result = await this.staffConfigService.pinLoan(user.id, body.loanId);
    return ResponseHelper.success(result, '置顶成功');
  }

  @Delete(`${LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY}/pin/:loanId`)
  async unpinLoan(
    @Param('loanId', ParseIntPipe) loanId: number,
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    const result = await this.staffConfigService.unpinLoan(user.id, loanId);
    return ResponseHelper.success(result, '取消置顶成功');
  }

  @Get(':key')
  async getConfig(
    @Param('key') key: string,
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    const result = await this.staffConfigService.getConfig(user.id, key);
    return ResponseHelper.success(result, '获取配置成功');
  }

  @Put(':key')
  async upsertConfig(
    @Param('key') key: string,
    @Body() body: UpsertStaffConfigDto,
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    const result = await this.staffConfigService.upsertConfig(
      user.id,
      key,
      body.value,
    );
    return ResponseHelper.success(result, '保存配置成功');
  }
}
