import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { ResponseHelper } from '../common/response-helper';
import { ArchivesService } from './archives.service';
import { CreateArchiveDto } from './dto/create-archive.dto';
import { UpdateArchiveDto } from './dto/update-archive.dto';

type UploadedArchiveFile = {
  originalname?: string;
  buffer: Buffer;
};

@Controller('archives')
@UseGuards(AuthGuard)
export class ArchivesController {
  constructor(private readonly archivesService: ArchivesService) {}

  /**
   * 上传档案照片，直接保存前端已压缩后的文件
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file?: UploadedArchiveFile) {
    if (!file) {
      throw new BadRequestException('请选择上传的文件');
    }
    const path = await this.archivesService.saveUploadedImage(file);
    return ResponseHelper.success(path, '上传成功');
  }

  /**
   * 创建档案
   */
  @Post()
  async create(
    @CurrentUser() user: { id: number },
    @Body() createArchiveDto: CreateArchiveDto,
  ) {
    const result = await this.archivesService.create(user.id, createArchiveDto);
    if (result.conflict) {
      return {
        code: 409,
        message: '已存在该 name 的档案信息',
        data: { id: result.existingId },
      };
    }
    return ResponseHelper.success({ id: result.archive.id }, '创建档案成功');
  }

  /**
   * 分页条件查询档案列表
   */
  @Get()
  async findAll(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    const data = await this.archivesService.findAll(
      keyword || '',
      pageNum,
      sizeNum,
    );
    return ResponseHelper.success(data, '获取档案列表成功');
  }

  /**
   * 按客户 user_id 查询档案
   */
  @Get('by-user')
  async findByUser(@Query('user_id') userId?: string) {
    const id = userId ? parseInt(userId, 10) : NaN;
    if (!userId || Number.isNaN(id)) {
      throw new BadRequestException('user_id 无效');
    }
    const archive = await this.archivesService.findByUserId(id);
    return ResponseHelper.success(
      archive
        ? { id: archive.id, name: archive.name, user_id: archive.user_id }
        : null,
      '查询完成',
    );
  }

  /**
   * 按姓名精确查询（用于创建前重名校验）
   */
  @Get('by-name')
  async findByName(@Query('name') name?: string) {
    const archive = await this.archivesService.findByExactName(name || '');
    return ResponseHelper.success(
      archive ? { id: archive.id, name: archive.name } : null,
      '查询完成',
    );
  }

  /**
   * 获取单份档案详情（附带当前用户的编辑/删除权限）
   */
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string },
  ) {
    const archive = await this.archivesService.findOne(id);
    const permissions = await this.archivesService.resolvePermissions(
      {
        name: archive.name,
        user_id: archive.user_id,
        creator_id: archive.creator_id,
        createdAt: archive.createdAt,
      },
      user,
    );
    return ResponseHelper.success(
      { ...archive, ...permissions },
      '获取档案详情成功',
    );
  }

  /**
   * 更新档案内容
   * 超级管理员/管理员始终可编辑；风控仅在关联方案未锁定时可编辑
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateArchiveDto: UpdateArchiveDto,
    @CurrentUser() user: { id: number; role: string },
  ) {
    await this.archivesService.assertCanEdit(id, user);
    const result = await this.archivesService.update(id, updateArchiveDto);
    if (result.conflict) {
      return {
        code: 409,
        message: '已存在该 name 的档案信息',
        data: { id: result.existingId },
      };
    }
    return ResponseHelper.success(result.archive, '更新档案成功');
  }

  /**
   * 删除档案（仅管理员与超级管理员有权限）
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(ManagementRoles.SUPER_ADMIN, ManagementRoles.ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.archivesService.remove(id);
    return ResponseHelper.success(null, '删除档案成功');
  }
}
