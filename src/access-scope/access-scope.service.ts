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
    const scopedUserId = isRequesterPlatformAdminRole
      ? targetUserId || undefined
      : requestUserId;

    let loanAccountIds: number[] = [];
    if (!canViewAll && scopedUserId) {
      loanAccountIds = await this.getLoanAccountIdsByUserId(scopedUserId);
    }

    return {
      requestUserId,
      targetUserId,
      isRequesterPlatformAdminRole,
      isAllAccessible: canViewAll,
      scopedUserId,
      loanAccountIds,
    };
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
