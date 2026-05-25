import { Injectable } from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ResolvedDataScope = {
  requestUserId: number;
  targetUserId?: number;
  isRequesterPlatformAdminRole: boolean;
  isAllAccessible: boolean;
  scopedUserId?: number;
  loanAccountIds: number[];
};

@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveLoanAccountScope(
    requestUserId: number,
    targetUserId?: number,
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
    const canViewAll = isRequesterPlatformAdminRole && !targetUserId;

    let loanAccountIds: number[] = [];
    if (isRequesterPlatformAdminRole) {
      if (targetUserId) {
        loanAccountIds = await this.getLoanAccountIdsByUserId(targetUserId);
      }
    } else {
      const requesterLoans = await this.getLoanAccountIdsByUserId(requestUserId);
      if (targetUserId) {
        const targetLoans = await this.getLoanAccountIdsByUserId(targetUserId);
        loanAccountIds = requesterLoans.filter((id) => targetLoans.includes(id));
      } else {
        loanAccountIds = requesterLoans;
      }
    }

    return {
      requestUserId,
      targetUserId,
      isRequesterPlatformAdminRole,
      isAllAccessible: canViewAll,
      scopedUserId: isRequesterPlatformAdminRole
        ? targetUserId || undefined
        : requestUserId,
      loanAccountIds,
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
          role: { in: [ManagementRoles.COLLECTOR, ManagementRoles.RISK_CONTROLLER] },
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

    const myLoanIds = await this.getLoanAccountIdsByUserId(userId);
    if (myLoanIds.length === 0) return [];

    const otherRoles = await this.prisma.loanAccountRole.findMany({
      where: {
        loan_account_id: { in: myLoanIds },
        admin_id: { not: userId },
      },
      select: {
        admin: {
          select: {
            id: true,
            username: true,
            nickname: true,
            role: true,
          },
        },
      },
      distinct: ['admin_id'],
    });

    return this.sortAdminsCollectorFirst(otherRoles.map((r) => r.admin));
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
    return [...admins].sort(
      (a, b) => roleOrder[a.role] - roleOrder[b.role],
    );
  }

  async getLoanAccountIdsByUserId(userId: number): Promise<number[]> {
    return this.getLoanAccountIdsByUserRole(userId);
  }

  async getLoanAccountIdsByUserRole(
    userId: number,
    roleType?: 'collector' | 'risk_controller',
  ): Promise<number[]> {
    const roles = await this.prisma.loanAccountRole.findMany({
      where: {
        admin_id: userId,
        ...(roleType ? { role_type: roleType } : {}),
      },
      select: { loan_account_id: true },
      distinct: ['loan_account_id'],
    });
    return roles.map((r) => r.loan_account_id);
  }
}
