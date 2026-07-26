import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface ChangelogItem {
  version: string;
  releasedAt: string;
  content: string;
}

@Injectable()
export class ChangelogsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChangelogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.syncChangelogsFromLocal();
  }

  /**
   * 解析 Markdown 格式的更新日志
   * 支持格式如：## [v1.1.0] - 2026-07-26 或 ## v1.0.1 (2026-05-14)
   */
  private parseMarkdownChangelog(mdContent: string): ChangelogItem[] {
    const lines = mdContent.split(/\r?\n/);
    const items: ChangelogItem[] = [];
    let currentItem: ChangelogItem | null = null;
    const contentLines: string[] = [];

    const flushCurrent = () => {
      if (currentItem) {
        currentItem.content = contentLines.join('\n').trim();
        if (currentItem.content) {
          items.push(currentItem);
        }
      }
    };

    const headerRegex =
      /^##\s+\[?([^\]\s]+)\]?(?:\s*[-–—(]\s*(\d{4}-\d{2}-\d{2})\)?)?/;

    for (const line of lines) {
      const match = line.match(headerRegex);
      if (match) {
        flushCurrent();
        contentLines.length = 0;
        const version = match[1].trim();
        const releasedAt = match[2]
          ? match[2].trim()
          : new Date().toISOString().split('T')[0];
        currentItem = {
          version,
          releasedAt,
          content: '',
        };
      } else if (currentItem) {
        contentLines.push(line);
      }
    }
    flushCurrent();
    return items;
  }

  /**
   * 程序启动时读取本地 CHANGELOG.md 文件并自动同步至数据库
   */
  async syncChangelogsFromLocal() {
    const mdPaths = [
      path.join(process.cwd(), 'src/changelogs/CHANGELOG.md'),
      path.join(__dirname, 'CHANGELOG.md'),
      path.join(process.cwd(), 'CHANGELOG.md'),
      path.join(process.cwd(), 'src/changelogs/changelogs.md'),
    ];

    let logsToSync: ChangelogItem[] = [];
    let readPath = '';

    for (const p of mdPaths) {
      if (fs.existsSync(p)) {
        try {
          const fileContent = fs.readFileSync(p, 'utf-8');
          const parsed = this.parseMarkdownChangelog(fileContent);
          if (parsed.length > 0) {
            logsToSync = parsed;
            readPath = p;
            break;
          }
        } catch (e) {
          const err = e as Error;
          this.logger.warn(`解析 Markdown 日志文件 ${p} 失败: ${err.message}`);
        }
      }
    }

    if (logsToSync.length === 0) {
      this.logger.warn(
        '未找到有效本地更新日志文件 CHANGELOG.md 或内容为空，跳过数据库同步。',
      );
      return;
    }

    this.logger.log(
      `从本地 Markdown 日志文件 [${readPath}] 读取到 ${logsToSync.length} 条更新日志`,
    );

    let syncedCount = 0;
    for (const item of logsToSync) {
      if (!item.version || !item.content || !item.releasedAt) continue;

      const releasedAtDate = new Date(item.releasedAt);
      if (isNaN(releasedAtDate.getTime())) {
        this.logger.warn(
          `跳过无效发布日期的日志: version=${item.version}, releasedAt=${item.releasedAt}`,
        );
        continue;
      }

      // 根据 version 查询数据库中是否已有该版本日志
      const existing = await this.prisma.changelog.findFirst({
        where: { version: item.version },
      });

      if (existing) {
        await this.prisma.changelog.update({
          where: { id: existing.id },
          data: {
            content: item.content,
            releasedAt: releasedAtDate,
          },
        });
      } else {
        await this.prisma.changelog.create({
          data: {
            version: item.version,
            content: item.content,
            releasedAt: releasedAtDate,
          },
        });
      }
      syncedCount++;
    }

    this.logger.log(
      `更新日志（Changelog）数据库自动同步完成，已同步 ${syncedCount} 条记录。`,
    );
  }

  async findRecent(limit = 10) {
    const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
    return this.prisma.changelog.findMany({
      orderBy: [{ releasedAt: 'desc' }, { id: 'desc' }],
      take: n,
      select: {
        id: true,
        releasedAt: true,
        version: true,
        content: true,
      },
    });
  }
}



