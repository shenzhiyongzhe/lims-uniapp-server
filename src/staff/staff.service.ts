import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.staff.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        nickname: true,
        role: true,
        openid: true,
        avatar_url: true,
        createdAt: true,
      },
    });
  }

  async updateRole(id: number, role: ManagementRoles) {
    return this.updateStaff(id, { role });
  }

  async updateStaff(id: number, dto: UpdateStaffDto) {
    const roleProvided = dto.role !== undefined;
    const usernameProvided = dto.username !== undefined;

    if (!roleProvided && !usernameProvided) {
      throw new BadRequestException('至少提供 username 或 role 之一');
    }

    let normalizedUsername: string | null | undefined;
    if (usernameProvided) {
      const s = dto.username == null ? '' : String(dto.username).trim();
      normalizedUsername = s.length === 0 ? null : s;
      if (normalizedUsername && normalizedUsername.length > 10) {
        throw new BadRequestException('用户名最多 10 个字符');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.staff.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`业务人员不存在: ${id}`);
      }

      const data: { username?: string | null; role?: ManagementRoles } = {};
      if (usernameProvided) {
        data.username = normalizedUsername ?? null;
      }
      if (roleProvided && dto.role !== undefined) {
        data.role = dto.role;
      }

      const staff = await tx.staff.update({
        where: { id },
        data,
      });

      if (roleProvided && dto.role === ManagementRoles.COLLECTOR) {
        await tx.collectorAssetManagement.upsert({
          where: { admin_id: id },
          update: {},
          create: { admin_id: id },
        });
      }

      if (roleProvided && dto.role === ManagementRoles.RISK_CONTROLLER) {
        await tx.riskControllerAssetManagement.upsert({
          where: { admin_id: id },
          update: {},
          create: { admin_id: id },
        });
      }

      return staff;
    });
  }

  async remove(id: number) {
    return this.prisma.staff.delete({
      where: { id },
    });
  }
}
