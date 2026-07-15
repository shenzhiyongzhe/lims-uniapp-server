import { ManagementRoles } from '@prisma/client';
import { AccessScopeService } from './access-scope.service';

describe('AccessScopeService.getAssociatedAdmins', () => {
  it('returns all collectors and risk controllers for ADMIN_LIMITED', async () => {
    const staffList = [
      {
        id: 1,
        username: 'c1',
        nickname: 'C1',
        role: ManagementRoles.COLLECTOR,
      },
      {
        id: 2,
        username: 'r1',
        nickname: 'R1',
        role: ManagementRoles.RISK_CONTROLLER,
      },
    ];
    const prisma = {
      staff: {
        findUnique: jest.fn().mockResolvedValue({
          id: 99,
          role: ManagementRoles.ADMIN_LIMITED,
        }),
        findMany: jest.fn().mockResolvedValue(staffList),
      },
    };
    const service = new AccessScopeService(prisma as any);
    const result = await service.getAssociatedAdmins(99);
    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: {
            in: [ManagementRoles.COLLECTOR, ManagementRoles.RISK_CONTROLLER],
          },
        },
      }),
    );
    expect(result.map((s) => s.id)).toEqual([1, 2]);
  });
});
