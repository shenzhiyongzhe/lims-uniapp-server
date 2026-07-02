import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LoanAccountsService } from './loanAccounts.service';
import { CreateLoanAccountDto } from './dto/create-loanAccount.dto';
import { UpdateLoanAccountDto } from './dto/update-loanAccount.dto';
import { UpdateLoanAccountStatusDto } from './dto/update-loan-account-status.dto';
import { UpdateLoanAccountLockDto } from './dto/update-loan-account-lock.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { AccessScopeService } from '../access-scope/access-scope.service';

@Controller('loan-accounts')
export class LoanAccountsController {
  constructor(
    private readonly loanAccountsService: LoanAccountsService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
  )
  @Get()
  async findAll(): Promise<ApiResponseDto> {
    const loans = await this.loanAccountsService.findAll();
    return ResponseHelper.success(loans, '获取贷款记录成功');
  }

  @UseGuards(AuthGuard)
  @Get('related-staffs')
  async findRelatedStaffs(
    @CurrentUser() user: { id: number },
    @Query('userId') queryUserId?: string,
  ): Promise<ApiResponseDto> {
    const targetUserId = queryUserId ? parseInt(queryUserId, 10) : user.id;
    const staffs =
      await this.accessScopeService.getAssociatedAdmins(targetUserId);
    return ResponseHelper.success(staffs, '获取相关业务人员成功');
  }

  @UseGuards(AuthGuard)
  @Get('assignable-staffs')
  async findAssignableStaffs(): Promise<ApiResponseDto> {
    const staffs = await this.loanAccountsService.findAssignableStaffs();
    return ResponseHelper.success(staffs, '获取可分配业务人员成功');
  }

  @UseGuards(AuthGuard)
  @Get('search')
  async search(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('username') username?: string,
    @Query('id') id?: string,
    @CurrentUser() currentUser?: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    const result = await this.loanAccountsService.searchLoanAccounts(
      {
        page: parseInt(page, 10) || 1,
        pageSize: parseInt(pageSize, 10) || 20,
        username,
        id,
      },
      currentUser,
    );
    return ResponseHelper.success(result, '搜索贷款记录成功');
  }

  @UseGuards(AuthGuard)
  @Get('grouped-by-user')
  async findGroupedByUser(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('status') status?: string,
    @Query('listFilter') listFilter?: string,
    @Query('collectorId') collectorId?: string,
    @Query('riskControllerId') riskControllerId?: string,
    @CurrentUser() currentUser?: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    const result = await this.loanAccountsService.findGroupedByUser(
      {
        page: parseInt(page, 10) || 1,
        pageSize: parseInt(pageSize, 10) || 20,
        status,
        listFilter,
        collectorId,
        riskControllerId,
      },
      currentUser,
    );
    return ResponseHelper.success(result, '获取贷款记录成功');
  }

  @UseGuards(AuthGuard)
  @Get('list-stats')
  async getListStats(
    @Query('listFilter') listFilter?: string,
    @Query('status') status?: string,
    @Query('collectorId') collectorId?: string,
    @Query('riskControllerId') riskControllerId?: string,
    @CurrentUser() currentUser?: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    const result = await this.loanAccountsService.findListStats(
      {
        listFilter,
        status,
        collectorId,
        riskControllerId,
      },
      currentUser,
    );
    return ResponseHelper.success(result, '获取统计数据成功');
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
  )
  @Get('deleted')
  async findDeletedLoans(): Promise<ApiResponseDto> {
    try {
      const list = await this.loanAccountsService.findDeletedLoans();
      return ResponseHelper.success(list, '获取已删除贷款记录成功');
    } catch (error: any) {
      return ResponseHelper.error(
        `获取已删除贷款记录失败: ${error.message}`,
        500,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('created-history')
  async findHistoryCreatedLoans(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @CurrentUser() currentUser?: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    try {
      const result = await this.loanAccountsService.findHistoryCreatedLoans(
        {
          page: parseInt(page, 10) || 1,
          pageSize: parseInt(pageSize, 10) || 20,
        },
        currentUser,
      );
      return ResponseHelper.success(result, '获取历史新增贷款记录成功');
    } catch (error: any) {
      return ResponseHelper.error(
        `获取历史新增贷款记录失败: ${error.message}`,
        500,
      );
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  @Post('deleted/:id/restore')
  async restoreDeletedLoan(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    try {
      const restored = await this.loanAccountsService.restoreDeletedLoan(
        id,
        user.id,
      );
      return ResponseHelper.success(restored, '恢复贷款记录成功');
    } catch (error: any) {
      return ResponseHelper.error(`恢复贷款记录失败: ${error.message}`, 500);
    }
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto> {
    const loan = await this.loanAccountsService.findById(id);
    if (!loan) {
      return ResponseHelper.error('贷款记录不存在', 400);
    }
    return ResponseHelper.success(loan, '获取贷款记录成功');
  }

  @UseGuards(AuthGuard)
  @Get(':id/operation-logs')
  async findOperationLogs(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto> {
    const logs = await this.loanAccountsService.findOperationLogs(id);
    return ResponseHelper.success(logs, '获取操作日志成功');
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.RISK_CONTROLLER,
  )
  @Post()
  async create(
    @Body() body: CreateLoanAccountDto,
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    try {
      const loan = await this.loanAccountsService.create(body, user.id);
      return ResponseHelper.success(loan, '创建贷款记录成功');
    } catch (error: any) {
      return ResponseHelper.error(`创建贷款记录失败: ${error.message}`, 500);
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  @Put(':id/lock')
  async setLock(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateLoanAccountLockDto,
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    try {
      await this.loanAccountsService.setLock(id, body.is_locked, user.id);
      const loan = await this.loanAccountsService.findById(id);
      return ResponseHelper.success(loan, body.is_locked ? '锁定成功' : '解锁成功');
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        return ResponseHelper.error(error.message, 404);
      }
      return ResponseHelper.error(
        `更新锁定状态失败: ${error.message}`,
        500,
      );
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  @Put(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateLoanAccountStatusDto,
    @CurrentUser() user: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    try {
      await this.loanAccountsService.updateAccountStatus(id, body, user);
      const loan = await this.loanAccountsService.findById(id);
      return ResponseHelper.success(loan, '更新贷款状态成功');
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        return ResponseHelper.error(error.message, 403);
      }
      return ResponseHelper.error(`更新贷款状态失败: ${error.message}`, 500);
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateLoanAccountDto,
    @CurrentUser() user: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    try {
      const updated = await this.loanAccountsService.update(id, body, user);
      return ResponseHelper.success(updated, '更新贷款记录成功');
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        return ResponseHelper.error(error.message, 403);
      }
      return ResponseHelper.error(`更新贷款记录失败: ${error.message}`, 500);
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
    try {
      await this.loanAccountsService.remove(id);
      return ResponseHelper.success(null, '删除贷款记录成功');
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        return ResponseHelper.error(error.message, 404);
      }
      if (error instanceof ForbiddenException) {
        return ResponseHelper.error(error.message, 403);
      }
      return ResponseHelper.error(`删除贷款记录失败: ${error.message}`, 500);
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.ADMIN_LIMITED,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  @Get(':id/overdue-records')
  async getOverdueRecords(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto> {
    try {
      const records = await this.loanAccountsService.getOverdueRecords(id);
      return ResponseHelper.success(records, '获取逾期记录成功');
    } catch (error: any) {
      return ResponseHelper.error(`获取逾期记录失败: ${error.message}`, 500);
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.SUPER_ADMIN,
    ManagementRoles.ADMIN,
    ManagementRoles.COLLECTOR,
  )
  @Delete(':id/overdue-records/:overdueRecordId')
  async deleteOverdueRecord(
    @Param('id', ParseIntPipe) id: number,
    @Param('overdueRecordId', ParseIntPipe) overdueRecordId: number,
    @CurrentUser() operator: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    try {
      await this.loanAccountsService.deleteOverdueRecord(
        id,
        overdueRecordId,
        operator,
      );
      return ResponseHelper.success(null, '删除逾期记录成功');
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        return ResponseHelper.error(error.message, 404);
      }
      if (error instanceof ForbiddenException) {
        return ResponseHelper.error(error.message, 403);
      }
      return ResponseHelper.error(`删除逾期记录失败: ${error.message}`, 500);
    }
  }
}
