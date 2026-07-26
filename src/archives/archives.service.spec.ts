import { BadRequestException } from '@nestjs/common';
import {
  ArchivesService,
  assertCompleteImageBuffer,
} from './archives.service';
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

describe('assertCompleteImageBuffer', () => {
  it('accepts a complete minimal JPEG (SOI…EOI)', () => {
    const jpeg = Buffer.alloc(32, 0);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[30] = 0xff;
    jpeg[31] = 0xd9;
    expect(assertCompleteImageBuffer(jpeg)).toBe('.jpg');
  });

  it('rejects truncated JPEG missing EOI', () => {
    const jpeg = Buffer.alloc(32, 0);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    expect(() => assertCompleteImageBuffer(jpeg)).toThrow(BadRequestException);
    expect(() => assertCompleteImageBuffer(jpeg)).toThrow(/损坏或不完整/);
  });

  it('rejects empty or tiny buffers', () => {
    expect(() => assertCompleteImageBuffer(undefined)).toThrow(
      BadRequestException,
    );
    expect(() => assertCompleteImageBuffer(Buffer.alloc(8))).toThrow(
      /损坏或为空/,
    );
  });

  it('accepts a complete minimal PNG', () => {
    const png = Buffer.alloc(32, 0);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    Buffer.from([
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]).copy(png, 20);
    expect(assertCompleteImageBuffer(png)).toBe('.png');
  });

  it('rejects non-image bytes', () => {
    expect(() => assertCompleteImageBuffer(Buffer.alloc(32, 0x41))).toThrow(
      /仅支持/,
    );
  });
});
