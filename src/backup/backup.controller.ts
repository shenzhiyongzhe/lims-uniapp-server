import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import * as express from 'express';
import { BackupService } from './backup.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ManagementRoles } from '@prisma/client';
import { ResponseHelper } from '../common/response-helper';
import * as path from 'path';
import * as fs from 'fs';

@Controller('backup')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ManagementRoles.SUPER_ADMIN)
export class BackupController {
  constructor(private readonly backupService: BackupService) { }

  @Get()
  async getBackups() {
    const list = await this.backupService.getBackupFiles();
    return ResponseHelper.success(list, '获取备份文件列表成功');
  }

  @Post()
  async triggerBackup() {
    const filename = await this.backupService.createBackupExcel();
    console.log('filename', filename);
    return ResponseHelper.success({ filename }, '生成数据备份成功');
  }

  @Get('download/:filename')
  async downloadBackup(
    @Param('filename') filename: string,
    @Res() res: express.Response,
  ) {
    const safeName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'backups', safeName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('备份文件不存在');
    }

    res.download(filePath, safeName, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(500).json({
            code: 500,
            message: '下载文件失败',
            data: null,
          });
        }
      }
    });
  }

  @Delete(':filename')
  async deleteBackup(@Param('filename') filename: string) {
    await this.backupService.deleteBackupFile(filename);
    return ResponseHelper.success(null, '删除备份文件成功');
  }
}
