import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { sanitizePersonName } from '../common/person-name-match';

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
