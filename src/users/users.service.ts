import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import {
  extractChinesePrefix,
  isSamePerson,
  sanitizePersonName,
} from '../common/person-name-match';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(search: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        username: {
          contains: search,
        },
      },
      take: 10,
    });
  }

  async create(username: string): Promise<User> {
    const normalized = sanitizePersonName(username);
    const existing = await this.prisma.user.findFirst({
      where: { username: normalized },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        username: normalized,
      },
    });
  }

  /** 按姓名模糊匹配查找客户，找不到则创建 */
  async findOrCreateByName(rawName: string): Promise<User> {
    const normalized = sanitizePersonName(rawName);
    if (!normalized) {
      throw new BadRequestException('客户姓名无效');
    }

    const prefix = extractChinesePrefix(normalized);
    const candidates = await this.prisma.user.findMany({
      where: prefix ? { username: { startsWith: prefix } } : { username: normalized },
    });
    const match = candidates.find((u) => isSamePerson(u.username, normalized));
    if (match) return match;

    return this.create(normalized);
  }

  async getLoanCount(username: string): Promise<number> {
    const normalized = sanitizePersonName(username);
    const user = await this.prisma.user.findFirst({
      where: { username: normalized },
    });
    if (!user) {
      return 0;
    }
    return this.prisma.loanAccount.count({
      where: { user_id: user.id },
    });
  }
}
