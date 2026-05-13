import {
  Body,
  Controller,
  Get,
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
  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
    const loan = await this.loanAccountsService.findById(id);
    if (!loan) {
      return ResponseHelper.error('贷款记录不存在', 400);
    }
    return ResponseHelper.success(loan, '获取贷款记录成功');
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
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateLoanAccountDto,
  ): Promise<ApiResponseDto> {
    try {
      const updated = await this.loanAccountsService.update(id, body);
      return ResponseHelper.success(updated, '更新贷款记录成功');
    } catch (error: any) {
      return ResponseHelper.error(`更新贷款记录失败: ${error.message}`, 500);
    }
  }
}
