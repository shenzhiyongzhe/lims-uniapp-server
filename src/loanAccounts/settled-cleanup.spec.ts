import { Test, TestingModule } from '@nestjs/testing';
import { LoanAccountsService } from './loanAccounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoanPredictionService } from '../loan-prediction/loan-prediction.service';
import { AssetManagementService } from '../asset-management/asset-management.service';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { ArchivesService } from '../archives/archives.service';
import { ConfigService } from '@nestjs/config';
import { StaffConfigService } from '../staff-config/staff-config.service';

describe('LoanAccountsService - Settled Cleanup', () => {
  let service: LoanAccountsService;
  let prisma: any;
  let archivesService: any;

  beforeEach(async () => {
    prisma = {
      loanAccount: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      repaymentRecord: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      repaymentSchedule: {
        deleteMany: jest.fn(),
      },
      loanAccountOperationLog: {
        deleteMany: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    archivesService = {
      removeByUserId: jest.fn().mockResolvedValue({ deleted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanAccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoanPredictionService, useValue: {} },
        { provide: AssetManagementService, useValue: {} },
        { provide: AccessScopeService, useValue: {} },
        { provide: ArchivesService, useValue: archivesService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: StaffConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<LoanAccountsService>(LoanAccountsService);
  });

  describe('getSettledCleanupPreview', () => {
    it('should aggregate preview amounts and cleanable archives correctly', async () => {
      const mockLoans = [
        {
          id: 101,
          user_id: 1,
          loan_amount: 10000,
          receiving_amount: 9000,
          handling_fee: 1000,
          company_cost: 8500,
          repaymentRecords: [{ paid_amount: 5000 }, { paid_amount: 6000 }],
        },
        {
          id: 102,
          user_id: 2,
          loan_amount: 20000,
          receiving_amount: 18000,
          handling_fee: 2000,
          company_cost: 17000,
          repaymentRecords: [{ paid_amount: 22000 }],
        },
      ];

      prisma.loanAccount.findMany.mockResolvedValue(mockLoans);
      // user 1 has no other loans, user 2 has 1 other loan in database
      prisma.loanAccount.groupBy.mockResolvedValue([{ user_id: 2, _count: { id: 1 } }]);

      const preview = await service.getSettledCleanupPreview('all');

      expect(preview.count).toBe(2);
      expect(preview.archiveCount).toBe(1); // Only user 1 has no other loans
      expect(preview.totalLoanAmount).toBe(30000);
      expect(preview.totalReceivingAmount).toBe(27000);
      expect(preview.totalHandlingFee).toBe(3000);
      expect(preview.totalCompanyCost).toBe(25500);
      expect(preview.totalRepaidAmount).toBe(33000);

      expect(prisma.loanAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { status: 'settled', is_stub: false },
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { status_changed_at: expect.objectContaining({ lt: expect.any(Date) }) },
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('should return zeros when no settled loans match', async () => {
      prisma.loanAccount.findMany.mockResolvedValue([]);

      const preview = await service.getSettledCleanupPreview('last_1_month');

      expect(preview.count).toBe(0);
      expect(preview.archiveCount).toBe(0);
      expect(preview.totalLoanAmount).toBe(0);
    });
  });

  describe('batchDeleteSettledLoans', () => {
    it('should return 0 count when no loans to clean', async () => {
      prisma.loanAccount.findMany.mockResolvedValue([]);

      const res = await service.batchDeleteSettledLoans('all', 99);

      expect(res.count).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should consolidate loans into stubs and physically remove details and lonely archives', async () => {
      const fixedDate = new Date('2026-07-15T10:00:00.000Z');
      const mockLoans = [
        {
          id: 1,
          user_id: 10,
          collector_id: 2,
          risk_controller_id: 3,
          loan_amount: 5000,
          receiving_amount: 4500,
          handling_fee: 500,
          company_cost: 4000,
          total_fines: 100,
          paid_capital: 5000,
          paid_interest: 500,
          created_at: fixedDate,
          status_changed_at: fixedDate,
          due_end_date: fixedDate,
          repaymentRecords: [{ paid_amount: 5600, paid_at: fixedDate, actual_collector_id: 2 }],
        },
        {
          id: 2,
          user_id: 10,
          collector_id: 2,
          risk_controller_id: 3,
          loan_amount: 6000,
          receiving_amount: 5400,
          handling_fee: 600,
          company_cost: 5000,
          total_fines: 0,
          paid_capital: 6000,
          paid_interest: 600,
          created_at: fixedDate,
          status_changed_at: fixedDate,
          due_end_date: fixedDate,
          repaymentRecords: [{ paid_amount: 6600, paid_at: fixedDate, actual_collector_id: 2 }],
        },
      ];

      prisma.loanAccount.findMany.mockResolvedValue(mockLoans);
      prisma.user.findFirst.mockResolvedValue({ id: 999, username: '系统归档' });
      prisma.loanAccount.create.mockResolvedValue({ id: 8888 });
      // user 10 has 0 remaining loans after deletion
      prisma.loanAccount.count.mockResolvedValue(0);

      const res = await service.batchDeleteSettledLoans('all', 1);

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);

      // Verify stub creation
      expect(prisma.loanAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 999,
          collector_id: 2,
          risk_controller_id: 3,
          loan_amount: 11000,
          receiving_amount: 9900,
          handling_fee: 1100,
          company_cost: 9000,
          is_stub: true,
          status: 'settled',
        }),
      });

      // Verify consolidated repayment record
      expect(prisma.repaymentRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loan_id: 8888,
          paid_amount: 12200,
        }),
      });

      // Verify physical deletion of old loans
      expect(prisma.loanAccount.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
      });

      // Verify archive and user physical cleanup
      expect(archivesService.removeByUserId).toHaveBeenCalledWith(10);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    });

    it('should delete specified loanIds when loanIds array is provided', async () => {
      prisma.loanAccount.findMany.mockResolvedValue([]);

      const res = await service.batchDeleteSettledLoans('custom_list', 1, [101, 102]);

      expect(prisma.loanAccount.findMany).toHaveBeenCalledWith({
        where: { id: { in: [101, 102] }, status: 'settled', is_stub: false },
        include: { repaymentRecords: true },
      });
      expect(res.count).toBe(0);
    });
  });

  describe('getSettledLoansList', () => {
    it('should query paginated settled loans correctly', async () => {
      prisma.loanAccount.count.mockResolvedValue(1);
      prisma.loanAccount.findMany.mockResolvedValue([
        {
          id: 50,
          user_id: 12,
          loan_amount: 5000,
          receiving_amount: 4500,
          handling_fee: 500,
          company_cost: 4000,
          total_fines: 0,
          created_at: new Date('2026-08-01'),
          due_end_date: new Date('2026-08-10'),
          status_changed_at: new Date('2026-08-10'),
          user: {
            id: 12,
            username: 'testuser',
            archives: [{ name: '张三' }],
          },
          collector: { id: 2, username: 'col1', nickname: '催收A' },
          risk_controller: { id: 3, username: 'rc1', nickname: '风控B' },
          repaymentRecords: [{ paid_amount: 5000 }],
        },
      ]);

      const res = await service.getSettledLoansList({ page: 1, pageSize: 10 });

      expect(res.total).toBe(1);
      expect(res.items.length).toBe(1);
      expect(res.items[0].customerName).toBe('张三');
      expect(res.items[0].collectorName).toBe('催收A');
      expect(res.items[0].riskControllerName).toBe('风控B');
      expect(res.items[0].totalRepaidAmount).toBe(5000);
      expect(res.hasMore).toBe(false);
    });
  });
});
