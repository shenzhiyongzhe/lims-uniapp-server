import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

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
    const existing = await this.prisma.user.findFirst({
      where: { username },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        username,
      },
    });
  }
}
