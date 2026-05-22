import {
  Body,
  Controller,
  Delete,
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
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';

@Controller('loan-accounts')
export class LoanAccountsController {
  constructor(private readonly loanAccountsService: LoanAccountsService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.ADMIN)
  @Get()
  async findAll(): Promise<ApiResponseDto> {
    const loans = await this.loanAccountsService.findAll();
    return ResponseHelper.success(loans, '获取贷款记录成功');
  }

  @UseGuards(AuthGuard)
  @Get('related-admins')
  async findRelatedAdmins(): Promise<ApiResponseDto> {
    const admins = await this.loanAccountsService.findRelatedAdmins();
    return ResponseHelper.success(admins, '获取相关管理员成功');
  }

  @UseGuards(AuthGuard)
  @Get('grouped-by-user')
  async findGroupedByUser(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('status') status?: string,
    @Query('adminId') adminId?: string,
    @Query('keyword') keyword?: string,
    @Query('username') username?: string,
    @Query('listFilter') listFilter?: string,
    @CurrentUser() user?: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    const result = await this.loanAccountsService.findGroupedByUser(
      {
        page: parseInt(page, 10) || 1,
        pageSize: parseInt(pageSize, 10) || 20,
        status,
        adminId,
        keyword,
        username,
        listFilter,
      },
      user,
    );
    return ResponseHelper.success(result, '获取贷款记录成功');
  }

  @UseGuards(AuthGuard)
  @Get('list-stats')
  async getListStats(
    @Query('adminId') adminId?: string,
    @Query('username') username?: string,
    @Query('listFilter') listFilter?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @CurrentUser() user?: { id: number; role: string },
  ): Promise<ApiResponseDto> {
    const result = await this.loanAccountsService.findListStats(
      { adminId, username, listFilter, status, keyword },
      user,
    );
    return ResponseHelper.success(result, '获取统计数据成功');
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
  @Roles(ManagementRoles.ADMIN, ManagementRoles.RISK_CONTROLLER)
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
  @Roles(
    ManagementRoles.ADMIN,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  @Put(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateLoanAccountStatusDto,
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    try {
      await this.loanAccountsService.updateAccountStatus(id, body, user.id);
      const loan = await this.loanAccountsService.findById(id);
      return ResponseHelper.success(loan, '更新贷款状态成功');
    } catch (error: any) {
      return ResponseHelper.error(`更新贷款状态失败: ${error.message}`, 500);
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(
    ManagementRoles.ADMIN,
    ManagementRoles.COLLECTOR,
    ManagementRoles.RISK_CONTROLLER,
  )
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateLoanAccountDto,
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    try {
      const updated = await this.loanAccountsService.update(id, body, user.id);
      return ResponseHelper.success(updated, '更新贷款记录成功');
    } catch (error: any) {
      return ResponseHelper.error(`更新贷款记录失败: ${error.message}`, 500);
    }
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(ManagementRoles.ADMIN)
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto> {
    try {
      await this.loanAccountsService.remove(id);
      return ResponseHelper.success(null, '删除贷款记录成功');
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        return ResponseHelper.error(error.message, 404);
      }
      return ResponseHelper.error(
        `删除贷款记录失败: ${error.message}`,
        500,
      );
    }
  }
}
