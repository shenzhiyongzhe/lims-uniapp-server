import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ManagementRoles } from '@prisma/client';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nickname: true,
        role: true,
        openid: true,
        avatar_url: true,
        createdAt: true,
      },
    });
  }

  async updateRole(id: number, role: ManagementRoles) {
    return this.prisma.$transaction(async (tx) => {
      const admin = await tx.admin.update({
        where: { id },
        data: { role },
      });

      if (role === ManagementRoles.COLLECTOR) {
        await tx.collectorAssetManagement.upsert({
          where: { admin_id: id },
          update: {},
          create: { admin_id: id },
        });
      }

      if (role === ManagementRoles.RISK_CONTROLLER) {
        await tx.riskControllerAssetManagement.upsert({
          where: { admin_id: id },
          update: {},
          create: { admin_id: id },
        });
      }

      return admin;
    });
  }

  async remove(id: number) {
    return this.prisma.admin.delete({
      where: { id },
    });
  }
}
