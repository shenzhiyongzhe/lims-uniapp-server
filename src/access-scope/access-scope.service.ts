import { Injectable } from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ResolvedDataScope = {
  requestUserId: number;
  isRequesterPlatformAdminRole: boolean;
  isAllAccessible: boolean;
  scopedUserId?: number;
  whereClause: any;
};

@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveLoanAccountScope(
    requestUserId: number,
    collectorId?: number,
    riskControllerId?: number,
  ): Promise<ResolvedDataScope> {
    const requester = await this.prisma.admin.findUnique({
      where: { id: requestUserId },
      select: { id: true, role: true },
    });

    if (!requester) {
      throw new Error('管理员不存在');
    }

    const isRequesterPlatformAdminRole =
      requester.role === ManagementRoles.ADMIN;
    const canViewAll =
      isRequesterPlatformAdminRole && !collectorId && !riskControllerId;

    const whereClause: any = {};
    if (isRequesterPlatformAdminRole) {
      if (collectorId) {
        whereClause.collector_id = collectorId;
      }
      if (riskControllerId) {
        whereClause.risk_controller_id = riskControllerId;
      }
    } else {
      if (requester.role === ManagementRoles.COLLECTOR) {
        whereClause.collector_id = requestUserId;
        if (riskControllerId) {
          whereClause.risk_controller_id = riskControllerId;
        }
      } else if (requester.role === ManagementRoles.RISK_CONTROLLER) {
        whereClause.risk_controller_id = requestUserId;
        if (collectorId) {
          whereClause.collector_id = collectorId;
        }
      } else {
        return {
          requestUserId,
          isRequesterPlatformAdminRole,
          isAllAccessible: false,
          scopedUserId: undefined,
          whereClause: { id: -1 },
        };
      }
    }

    return {
      requestUserId,
      isRequesterPlatformAdminRole,
      isAllAccessible: canViewAll,
      scopedUserId: isRequesterPlatformAdminRole
        ? collectorId || undefined
        : requester.role === ManagementRoles.COLLECTOR
          ? requestUserId
          : collectorId || undefined,
      whereClause,
    };
  }

  async getAssociatedAdmins(userId: number): Promise<any[]> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!admin) {
      throw new Error('管理员不存在');
    }

    if (admin.role === ManagementRoles.ADMIN) {
      const admins = await this.prisma.admin.findMany({
        where: {
          role: {
            in: [ManagementRoles.COLLECTOR, ManagementRoles.RISK_CONTROLLER],
          },
        },
        select: {
          id: true,
          username: true,
          nickname: true,
          role: true,
        },
      });
      return this.sortAdminsCollectorFirst(admins);
    }

    const myLoans = await this.prisma.loanAccount.findMany({
      where: {
        OR: [
          { collector_id: userId },
          { risk_controller_id: userId },
        ],
      },
      select: {
        collector_id: true,
        risk_controller_id: true,
      },
    });

    const otherAdminIds = new Set<number>();
    for (const loan of myLoans) {
      if (loan.collector_id && loan.collector_id !== userId) {
        otherAdminIds.add(loan.collector_id);
      }
      if (loan.risk_controller_id && loan.risk_controller_id !== userId) {
        otherAdminIds.add(loan.risk_controller_id);
      }
    }

    if (otherAdminIds.size === 0) return [];

    const otherAdmins = await this.prisma.admin.findMany({
      where: {
        id: { in: Array.from(otherAdminIds) },
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        role: true,
      },
    });

    return this.sortAdminsCollectorFirst(otherAdmins);
  }

  /** COLLECTOR 在前，RISK_CONTROLLER 在后 */
  private sortAdminsCollectorFirst<T extends { role: ManagementRoles }>(
    admins: T[],
  ): T[] {
    const roleOrder: Record<ManagementRoles, number> = {
      [ManagementRoles.ADMIN]: 99,
      [ManagementRoles.RISK_CONTROLLER]: 1,
      [ManagementRoles.COLLECTOR]: 0,
      [ManagementRoles.PENDING]: 99,
    };
    return [...admins].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  }

  async getLoanAccountIdsByUserId(userId: number): Promise<number[]> {
    return this.getLoanAccountIdsByUserRole(userId);
  }

  async getLoanAccountIdsByUserRole(
    userId: number,
    roleType?: 'collector' | 'risk_controller',
  ): Promise<number[]> {
    const whereClause: any = {};
    if (roleType === 'collector') {
      whereClause.collector_id = userId;
    } else if (roleType === 'risk_controller') {
      whereClause.risk_controller_id = userId;
    } else {
      whereClause.OR = [
        { collector_id: userId },
        { risk_controller_id: userId },
      ];
    }
    const loans = await this.prisma.loanAccount.findMany({
      where: whereClause,
      select: { id: true },
    });
    return loans.map((l) => l.id);
  }
}
