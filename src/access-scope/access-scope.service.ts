import { Injectable } from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ResolvedDataScope = {
  requestAdminId: number;
  targetAdminId?: number;
  isRequesterAdmin: boolean;
  isAllAccessible: boolean;
  scopedAdminId?: number;
  loanAccountIds: number[];
};

@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveLoanAccountScope(
    requestAdminId: number,
    targetAdminId?: number,
  ): Promise<ResolvedDataScope> {
    const requester = await this.prisma.admin.findUnique({
      where: { id: requestAdminId },
      select: { id: true, role: true },
    });

    if (!requester) {
      throw new Error('管理员不存在');
    }

    const isRequesterAdmin = requester.role === ManagementRoles.ADMIN;
    const canViewAll = isRequesterAdmin && !targetAdminId;
    const scopedAdminId = isRequesterAdmin
      ? targetAdminId || undefined
      : requestAdminId;

    let loanAccountIds: number[] = [];
    if (!canViewAll && scopedAdminId) {
      loanAccountIds = await this.getLoanAccountIdsByAdminId(scopedAdminId);
    }

    return {
      requestAdminId,
      targetAdminId,
      isRequesterAdmin,
      isAllAccessible: canViewAll,
      scopedAdminId,
      loanAccountIds,
    };
  }

  async getLoanAccountIdsByAdminId(adminId: number): Promise<number[]> {
    return this.getLoanAccountIdsByAdminRole(adminId);
  }

  async getLoanAccountIdsByAdminRole(
    adminId: number,
    roleType?: 'collector' | 'risk_controller',
  ): Promise<number[]> {
    const roles = await this.prisma.loanAccountRole.findMany({
      where: {
        admin_id: adminId,
        ...(roleType ? { role_type: roleType } : {}),
      },
      select: { loan_account_id: true },
      distinct: ['loan_account_id'],
    });
    return roles.map((r) => r.loan_account_id);
  }
}
