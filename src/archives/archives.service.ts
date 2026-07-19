import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArchiveDto } from './dto/create-archive.dto';
import { UpdateArchiveDto } from './dto/update-archive.dto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

export type ArchiveOperator = { id: number; role: string };

export type ArchivePermissions = {
  can_edit: boolean;
  can_delete: boolean;
};

@Injectable()
export class ArchivesService {
  private readonly logger = new Logger(ArchivesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isPlatformAdmin(role: string): boolean {
    const r = String(role || '').toUpperCase();
    return r === ManagementRoles.SUPER_ADMIN || r === ManagementRoles.ADMIN;
  }

  /**
   * 档案与方案按客户姓名（archive.name ≈ user.username）关联。
   * 风控仅在「本人负责且未锁定」的方案存在时可编辑。
   */
  async resolvePermissions(
    archiveName: string,
    operator: ArchiveOperator,
  ): Promise<ArchivePermissions> {
    const role = String(operator.role || '').toUpperCase();

    if (this.isPlatformAdmin(role)) {
      return { can_edit: true, can_delete: true };
    }

    if (role === ManagementRoles.RISK_CONTROLLER) {
      const unlockedLoan = await this.prisma.loanAccount.findFirst({
        where: {
          is_locked: false,
          risk_controller_id: operator.id,
          user: { username: archiveName },
        },
        select: { id: true },
      });
      return { can_edit: !!unlockedLoan, can_delete: false };
    }

    // ADMIN_LIMITED 及其他角色：只读
    return { can_edit: false, can_delete: false };
  }

  async assertCanEdit(id: number, operator: ArchiveOperator): Promise<void> {
    const archive = await this.findOne(id);
    const permissions = await this.resolvePermissions(archive.name, operator);
    if (!permissions.can_edit) {
      throw new ForbiddenException('无权编辑该档案');
    }
  }

  /**
   * 保存并压缩图片
   */
  async saveCompressedImage(file: Express.Multer.File): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'archives');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const outputPath = path.join(uploadDir, filename);

    try {
      await sharp(file.buffer)
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
      
      return `/uploads/archives/${filename}`;
    } catch (error) {
      this.logger.error(`图片压缩保存失败: ${(error as Error).message}`);
      throw new Error(`图片压缩处理失败: ${(error as Error).message}`);
    }
  }

  /**
   * 删除物理图片文件
   */
  deleteLocalFiles(photos: string[]) {
    for (const photo of photos) {
      if (!photo || !photo.startsWith('/uploads/')) continue;
      // 拼出绝对路径
      const absolutePath = path.join(process.cwd(), photo);
      try {
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
          this.logger.log(`物理图片已清理: ${absolutePath}`);
        }
      } catch (err) {
        this.logger.error(`清理物理图片失败: ${absolutePath}, error: ${(err as Error).message}`);
      }
    }
  }

  /**
   * 按姓名精确查找档案（用于唯一性校验）
   */
  async findByExactName(name: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    return this.prisma.archive.findUnique({
      where: { name: trimmed },
      select: { id: true, name: true },
    });
  }

  /**
   * 创建档案
   */
  async create(creatorId: number, dto: CreateArchiveDto) {
    const name = (dto.name || '').trim();
    const existing = await this.findByExactName(name);
    if (existing) {
      return { conflict: true as const, existingId: existing.id };
    }

    const { date, photos, ...rest } = dto;
    const parsedDate = date ? new Date(date) : null;

    const archive = await this.prisma.archive.create({
      data: {
        ...rest,
        name,
        creator_id: creatorId,
        date: parsedDate,
        photos: photos || [],
      },
    });
    return { conflict: false as const, archive };
  }

  /**
   * 查询档案列表
   */
  async findAll(keyword = '', page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    
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

  /**
   * 查询单条档案详情
   */
  async findOne(id: number) {
    const archive = await this.prisma.archive.findUnique({
      where: { id },
    });
    if (!archive) {
      throw new NotFoundException('档案不存在');
    }
    return archive;
  }

  /**
   * 更新档案
   */
  async update(id: number, dto: UpdateArchiveDto) {
    const archive = await this.findOne(id);

    if (dto.name !== undefined) {
      const nextName = dto.name.trim();
      if (nextName !== archive.name) {
        const existing = await this.findByExactName(nextName);
        if (existing && existing.id !== id) {
          return { conflict: true as const, existingId: existing.id };
        }
      }
      dto = { ...dto, name: nextName };
    }

    const { date, photos, ...rest } = dto;
    const parsedDate = date !== undefined ? (date ? new Date(date) : null) : undefined;
    
    // 如果有传入新的照片列表，对比并清理失效的物理文件
    if (photos !== undefined) {
      const oldPhotos = (archive.photos as string[]) || [];
      const newPhotosSet = new Set(photos);
      const removedPhotos = oldPhotos.filter(p => !newPhotosSet.has(p));
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

  /**
   * 删除档案
   */
  async remove(id: number) {
    const archive = await this.findOne(id);
    
    // 清理所有物理照片文件
    const photos = (archive.photos as string[]) || [];
    this.deleteLocalFiles(photos);

    await this.prisma.archive.delete({
      where: { id },
    });

    return { success: true };
  }
}
