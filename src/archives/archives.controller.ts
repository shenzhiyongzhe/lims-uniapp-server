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

@Controller('archives')
@UseGuards(AuthGuard)
export class ArchivesController {
  constructor(private readonly archivesService: ArchivesService) {}

  /**
   * 上传档案照片，自动进行服务器端图片压缩
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择上传的文件');
    }
    const path = await this.archivesService.saveCompressedImage(file);
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
    const archive = await this.archivesService.create(user.id, createArchiveDto);
    return ResponseHelper.success({ id: archive.id }, '创建档案成功');
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
   * 获取单份档案详情
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const archive = await this.archivesService.findOne(id);
    return ResponseHelper.success(archive, '获取档案详情成功');
  }

  /**
   * 更新档案内容
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateArchiveDto: UpdateArchiveDto,
  ) {
    const updated = await this.archivesService.update(id, updateArchiveDto);
    return ResponseHelper.success(updated, '更新档案成功');
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
