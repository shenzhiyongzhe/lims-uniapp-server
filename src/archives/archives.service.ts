import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateArchiveDto } from './dto/create-archive.dto';
import { UpdateArchiveDto } from './dto/update-archive.dto';
import {
  extractChinesePrefix,
  isSamePerson,
  sanitizePersonName,
} from '../common/person-name-match';
import * as fs from 'fs';
import * as path from 'path';

export type ArchiveOperator = { id: number; role: string };

export type ArchivePermissions = {
  can_edit: boolean;
  can_delete: boolean;
};

export type ArchiveIdentity = {
  name: string;
  user_id: number | null;
  creator_id?: number | null;
  createdAt?: Date | string | null;
};

type UploadedArchiveFile = {
  originalname?: string;
  buffer: Buffer;
};

@Injectable()
export class ArchivesService {
  private readonly logger = new Logger(ArchivesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private isPlatformAdmin(role: string): boolean {
    const r = String(role || '').toUpperCase();
    return r === ManagementRoles.SUPER_ADMIN || r === ManagementRoles.ADMIN;
  }

  /**
   * 档案与方案按 user_id 关联；无 user_id 时回退姓名模糊匹配。
   * 编辑权限规则：
   * 1. 超级管理员 / 管理员 始终可编辑；
   * 2. 创建人在 24 小时内有编辑权限；
   * 3. 风控角色在关联方案未锁定时有编辑权限。
   */
  async resolvePermissions(
    archive: ArchiveIdentity,
    operator: ArchiveOperator,
  ): Promise<ArchivePermissions> {
    const role = String(operator.role || '').toUpperCase();

    if (this.isPlatformAdmin(role)) {
      return { can_edit: true, can_delete: true };
    }

    let canEdit = false;

    // 创建人在 24 小时内拥有编辑权限
    if (
      archive.creator_id &&
      archive.creator_id === operator.id &&
      archive.createdAt
    ) {
      const createdTime = new Date(archive.createdAt).getTime();
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      if (!isNaN(createdTime) && now - createdTime <= TWENTY_FOUR_HOURS) {
        canEdit = true;
      }
    }

    if (!canEdit && role === ManagementRoles.RISK_CONTROLLER) {
      const userIds = await this.resolveUserIdsForArchive(archive);
      if (userIds.length > 0) {
        const unlockedLoan = await this.prisma.loanAccount.findFirst({
          where: {
            is_locked: false,
            risk_controller_id: operator.id,
            user_id: { in: userIds },
          },
          select: { id: true },
        });
        canEdit = !!unlockedLoan;
      }
    }

    return { can_edit: canEdit, can_delete: false };
  }

  private async resolveUserIdsForArchive(
    archive: ArchiveIdentity,
  ): Promise<number[]> {
    if (archive.user_id) {
      return [archive.user_id];
    }

    const prefix = extractChinesePrefix(archive.name);
    const users = await this.prisma.user.findMany({
      where: prefix
        ? { username: { startsWith: prefix } }
        : { username: sanitizePersonName(archive.name) },
      select: { id: true, username: true },
    });
    return users
      .filter((u) => isSamePerson(u.username, archive.name))
      .map((u) => u.id);
  }

  async assertCanEdit(id: number, operator: ArchiveOperator): Promise<void> {
    const archive = await this.findOne(id);
    const permissions = await this.resolvePermissions(
      {
        name: archive.name,
        user_id: archive.user_id,
        creator_id: archive.creator_id,
        createdAt: archive.createdAt,
      },
      operator,
    );
    if (!permissions.can_edit) {
      throw new ForbiddenException('无权编辑该档案');
    }
  }

  async saveUploadedImage(file: UploadedArchiveFile): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'archives');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const originalExt = path.extname(file.originalname || '').toLowerCase();
    const ext = originalExt || '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const outputPath = path.join(uploadDir, filename);

    try {
      await fs.promises.writeFile(outputPath, file.buffer);

      return `/uploads/archives/${filename}`;
    } catch (error) {
      this.logger.error(`图片保存失败: ${(error as Error).message}`);
      throw new Error(`图片保存失败: ${(error as Error).message}`);
    }
  }

  deleteLocalFiles(photos: string[]) {
    for (const photo of photos) {
      if (!photo || !photo.startsWith('/uploads/')) continue;
      const absolutePath = path.join(process.cwd(), photo);
      try {
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
          this.logger.log(`物理图片已清理: ${absolutePath}`);
        }
      } catch (err) {
        this.logger.error(
          `清理物理图片失败: ${absolutePath}, error: ${(err as Error).message}`,
        );
      }
    }
  }

  async findByUserId(userId: number) {
    return this.prisma.archive.findUnique({
      where: { user_id: userId },
      select: { id: true, name: true, user_id: true },
    });
  }

  async findMatchingArchive(name: string) {
    const normalized = sanitizePersonName(name);
    if (!normalized) return null;

    const prefix = extractChinesePrefix(normalized);
    const candidates = await this.prisma.archive.findMany({
      where: prefix ? { name: { startsWith: prefix } } : { name: normalized },
      select: { id: true, name: true, user_id: true },
      take: 50,
    });

    return (
      candidates.find((item) => isSamePerson(item.name, normalized)) || null
    );
  }

  async findByExactName(name: string) {
    return this.findMatchingArchive(name);
  }

  async create(creatorId: number, dto: CreateArchiveDto) {
    let userId = dto.user_id;
    let name = sanitizePersonName(dto.name);

    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('客户不存在');
      }
      name = user.username;
    } else if (name) {
      const user = await this.usersService.findOrCreateByName(name);
      userId = user.id;
      name = user.username;
    } else {
      throw new BadRequestException('请提供客户姓名或 user_id');
    }

    const existing = await this.findByUserId(userId);
    if (existing) {
      return { conflict: true as const, existingId: existing.id };
    }

    const { date, photos, ...rest } = dto;
    delete (rest as Partial<CreateArchiveDto>).user_id;
    delete (rest as Partial<CreateArchiveDto>).name;
    const parsedDate = date ? new Date(date) : null;

    const archive = await this.prisma.archive.create({
      data: {
        ...rest,
        name,
        user_id: userId,
        creator_id: creatorId,
        date: parsedDate,
        photos: photos || [],
      },
    });
    return { conflict: false as const, archive };
  }

  async findAll(keyword = '', page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const where: Record<string, unknown> = {};

    if (keyword.trim()) {
      where.name = {
        contains: keyword.trim(),
        mode: 'insensitive',
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.archive.count({ where }),
      this.prisma.archive.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return { total, items };
  }

  async findOne(id: number) {
    const archive = await this.prisma.archive.findUnique({
      where: { id },
    });
    if (!archive) {
      throw new NotFoundException('档案不存在');
    }
    return archive;
  }

  async update(id: number, dto: UpdateArchiveDto) {
    const archive = await this.findOne(id);

    if (dto.name !== undefined) {
      const nextName = sanitizePersonName(dto.name);
      if (nextName !== archive.name) {
        const existing = await this.findMatchingArchive(nextName);
        if (existing && existing.id !== id) {
          return { conflict: true as const, existingId: existing.id };
        }
      }
      dto = { ...dto, name: nextName };
    }

    const { date, photos, ...rest } = dto;
    const parsedDate =
      date !== undefined ? (date ? new Date(date) : null) : undefined;

    if (photos !== undefined) {
      const oldPhotos = (archive.photos as string[]) || [];
      const newPhotosSet = new Set(photos);
      const removedPhotos = oldPhotos.filter((p) => !newPhotosSet.has(p));
      this.deleteLocalFiles(removedPhotos);
    }

    const updated = await this.prisma.archive.update({
      where: { id },
      data: {
        ...rest,
        ...(parsedDate !== undefined ? { date: parsedDate } : {}),
        ...(photos !== undefined ? { photos } : {}),
      },
    });

    return { conflict: false as const, archive: updated };
  }

  async remove(id: number) {
    const archive = await this.findOne(id);
    const photos = (archive.photos as string[]) || [];
    this.deleteLocalFiles(photos);

    await this.prisma.archive.delete({
      where: { id },
    });

    return { success: true };
  }

  async removeByUserId(userId: number) {
    const archive = await this.findByUserId(userId);
    if (!archive) return { deleted: false };

    return this.remove(archive.id).then(() => ({
      deleted: true,
      id: archive.id,
    }));
  }

  async removeByName(name: string) {
    const archive = await this.findMatchingArchive(name);
    if (!archive) return { deleted: false };

    if (archive.user_id) {
      return this.removeByUserId(archive.user_id);
    }

    return this.remove(archive.id).then(() => ({
      deleted: true,
      id: archive.id,
    }));
  }
}
