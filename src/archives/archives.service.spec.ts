import { ArchivesService } from './archives.service';
import { ManagementRoles } from '@prisma/client';

describe('ArchivesService - resolvePermissions', () => {
  let service: ArchivesService;
  let mockPrismaService: any;
  let mockUsersService: any;

  beforeEach(() => {
    mockPrismaService = {
      loanAccount: {
        findFirst: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };
    mockUsersService = {};

    service = new ArchivesService(mockPrismaService, mockUsersService);
  });

  it('should grant edit and delete permissions for platform admin', async () => {
    const archive = {
      name: '张三',
      user_id: 1,
      creator_id: 99,
      createdAt: new Date('2020-01-01'),
    };
    const operator = { id: 10, role: ManagementRoles.ADMIN };

    const result = await service.resolvePermissions(archive, operator);

    expect(result).toEqual({ can_edit: true, can_delete: true });
  });

  it('should grant edit permission for creator within 24 hours', async () => {
    const now = Date.now();
    const twentyHoursAgo = new Date(now - 20 * 60 * 60 * 1000);
    const archive = {
      name: '李四',
      user_id: 2,
      creator_id: 10,
      createdAt: twentyHoursAgo,
    };
    const operator = { id: 10, role: ManagementRoles.COLLECTOR };

    const result = await service.resolvePermissions(archive, operator);

    expect(result.can_edit).toBe(true);
    expect(result.can_delete).toBe(false);
  });

  it('should deny edit permission for creator after 24 hours if no other rule matches', async () => {
    const now = Date.now();
    const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000);
    const archive = {
      name: '李四',
      user_id: 2,
      creator_id: 10,
      createdAt: twentyFiveHoursAgo,
    };
    const operator = { id: 10, role: ManagementRoles.COLLECTOR };

    const result = await service.resolvePermissions(archive, operator);

    expect(result.can_edit).toBe(false);
    expect(result.can_delete).toBe(false);
  });

  it('should grant edit permission for risk controller if unlocked loan exists even if after 24 hours', async () => {
    const now = Date.now();
    const thirtyHoursAgo = new Date(now - 30 * 60 * 60 * 1000);
    const archive = {
      name: '王五',
      user_id: 3,
      creator_id: 99,
      createdAt: thirtyHoursAgo,
    };
    const operator = { id: 15, role: ManagementRoles.RISK_CONTROLLER };

    mockPrismaService.loanAccount.findFirst.mockResolvedValue({ id: 101 });

    const result = await service.resolvePermissions(archive, operator);

    expect(result.can_edit).toBe(true);
    expect(result.can_delete).toBe(false);
  });
});
