import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async search(@Query('search') search: string): Promise<ApiResponseDto> {
    const users = await this.usersService.search(search);
    return ResponseHelper.success(users, '获取用户列表成功');
  }

  @Post()
  async create(@Body('username') username: string): Promise<ApiResponseDto> {
    if (!username) {
      return ResponseHelper.error('用户名不能为空', 400);
    }
    const user = await this.usersService.create(username);
    return ResponseHelper.success(user, '创建用户成功');
  }
}
