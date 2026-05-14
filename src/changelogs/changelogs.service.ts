import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChangelogsService {
  constructor(private readonly prisma: PrismaService) {}

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
