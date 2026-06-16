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
    const requester = await this.prisma.staff.findUnique({
      where: { id: requestUserId },
      select: { id: true, role: true },
    });

    if (!requester) {
      throw new Error('业务人员不存在');
    }

    const isRequesterPlatformAdminRole =
      requester.role === ManagementRoles.SUPER_ADMIN ||
      requester.role === ManagementRoles.ADMIN ||
      requester.role === ManagementRoles.ADMIN_LIMITED;
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
    const staff = await this.prisma.staff.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!staff) {
      throw new Error('业务人员不存在');
    }

    if (
      staff.role === ManagementRoles.SUPER_ADMIN ||
      staff.role === ManagementRoles.ADMIN ||
      staff.role === ManagementRoles.ADMIN_LIMITED
    ) {
      const staffs = await this.prisma.staff.findMany({
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
      return this.sortStaffCollectorFirst(staffs);
    }

    if (staff.role === ManagementRoles.RISK_CONTROLLER) {
      const collectors = await this.prisma.staff.findMany({
        where: { role: ManagementRoles.COLLECTOR },
        select: {
          id: true,
          username: true,
          nickname: true,
          role: true,
        },
      });

      const loanSums = await this.prisma.loanAccount.groupBy({
        by: ['collector_id'],
        where: {
          risk_controller_id: userId,
        },
        _sum: {
          handling_fee: true,
          company_cost: true,
        },
      });

      const sumsMap = new Map<number, { handling_fee: number; company_cost: number }>();
      for (const sum of loanSums) {
        if (sum.collector_id) {
          sumsMap.set(sum.collector_id, {
            handling_fee: sum._sum.handling_fee || 0,
            company_cost: sum._sum.company_cost || 0,
          });
        }
      }

      const result = collectors.map((s) => {
        const sums = sumsMap.get(s.id) || { handling_fee: 0, company_cost: 0 };
        return {
          ...s,
          handling_fee_sum: sums.handling_fee,
          company_cost_sum: sums.company_cost,
        };
      });

      return this.sortStaffCollectorFirst(result);
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

    const otherStaffIds = new Set<number>();
    for (const loan of myLoans) {
      if (loan.collector_id && loan.collector_id !== userId) {
        otherStaffIds.add(loan.collector_id);
      }
      if (loan.risk_controller_id && loan.risk_controller_id !== userId) {
        otherStaffIds.add(loan.risk_controller_id);
      }
    }

    if (otherStaffIds.size === 0) return [];

    const otherStaffs = await this.prisma.staff.findMany({
      where: {
        id: { in: Array.from(otherStaffIds) },
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        role: true,
      },
    });

    return this.sortStaffCollectorFirst(otherStaffs);
  }

  /** COLLECTOR 在前，RISK_CONTROLLER 在后 */
  private sortStaffCollectorFirst<T extends { role: ManagementRoles }>(
    staffs: T[],
  ): T[] {
    const roleOrder: Record<ManagementRoles, number> = {
      [ManagementRoles.SUPER_ADMIN]: 99,
      [ManagementRoles.ADMIN]: 99,
      [ManagementRoles.ADMIN_LIMITED]: 99,
      [ManagementRoles.RISK_CONTROLLER]: 1,
      [ManagementRoles.COLLECTOR]: 0,
      [ManagementRoles.PENDING]: 99,
    };
    return [...staffs].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
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
