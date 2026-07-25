import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';

@Injectable()
export class ErrorLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(staffId: number | null, dto: CreateErrorLogDto) {
    return this.prisma.clientErrorLog.create({
      data: {
        staff_id: staffId ?? undefined,
        level: dto.level || 'error',
        type: dto.type || 'js',
        message: dto.message,
        stack: dto.stack || null,
        page_route: dto.pageRoute || null,
        device_info: dto.deviceInfo ?? undefined,
      },
    });
  }

  async findAll(page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.clientErrorLog.findMany({
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        include: {
          staff: {
            select: { id: true, username: true, nickname: true, role: true },
          },
        },
      }),
      this.prisma.clientErrorLog.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async clearAll() {
    return this.prisma.clientErrorLog.deleteMany();
  }
}
