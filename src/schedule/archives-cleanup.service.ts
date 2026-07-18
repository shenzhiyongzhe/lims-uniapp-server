import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ArchivesCleanupService {
  private readonly logger = new Logger(ArchivesCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 每日凌晨 2:30 执行清理任务
   */
  @Cron('0 30 2 * * *', { timeZone: 'Asia/Shanghai' })
  async cleanupOldArchivePhotos() {
    this.logger.log('Starting scheduled cleanup of old archive photos...');
    
    // 计算 60 天前的时间点
    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - 60);

    try {
      // 找出 60 天前的档案
      const oldArchives = await this.prisma.archive.findMany({
        where: {
          createdAt: {
            lte: cutOffDate,
          },
        },
      });

      let cleanedCount = 0;

      for (const archive of oldArchives) {
        const photos = (archive.photos as string[]) || [];
        if (photos.length === 0) continue;

        // 检查在此档案创建时间之后，是否有同名用户的新增方案
        const matchingLoan = await this.prisma.loanAccount.findFirst({
          where: {
            created_at: {
              gte: archive.createdAt,
            },
            user: {
              username: archive.name,
            },
          },
        });

        // 如果没有匹配的方案，则清理照片
        if (!matchingLoan) {
          this.logger.log(
            `Archive ID ${archive.id} (name: "${archive.name}", created at: ${archive.createdAt.toISOString()}) has no matching loan account. Cleaning photos...`
          );

          // 物理清理图片文件
          for (const photo of photos) {
            if (!photo || !photo.startsWith('/uploads/')) continue;
            const absolutePath = path.join(process.cwd(), photo);
            try {
              if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
                this.logger.log(`Cleanup: Deleted file ${absolutePath}`);
              }
            } catch (err) {
              this.logger.error(`Cleanup: Failed to delete file ${absolutePath}, error: ${(err as Error).message}`);
            }
          }

          // 将数据库照片字段置为空数组
          await this.prisma.archive.update({
            where: { id: archive.id },
            data: { photos: [] },
          });

          cleanedCount++;
        }
      }

      this.logger.log(`Cleanup finished. Cleaned photos for ${cleanedCount} archive(s).`);
    } catch (error) {
      this.logger.error(`Scheduled cleanup failed: ${(error as Error).message}`);
    }
  }
}
