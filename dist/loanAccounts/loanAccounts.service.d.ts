import { PrismaService } from '../prisma/prisma.service';
import { LoanAccount } from '@prisma/client';
import { CreateLoanAccountDto } from './dto/create-loanAccount.dto';
import { UpdateLoanAccountDto } from './dto/update-loanAccount.dto';
import { UpdateLoanAccountStatusDto } from './dto/update-loan-account-status.dto';
import { LoanPredictionService } from '../loan-prediction/loan-prediction.service';
import { AssetManagementService } from '../asset-management/asset-management.service';
export declare class LoanAccountsService {
    private readonly prisma;
    private readonly loanPredictionService;
    private readonly assetManagementService;
    constructor(prisma: PrismaService, loanPredictionService: LoanPredictionService, assetManagementService: AssetManagementService);
    private toNumber;
    private isOverdue;
    private determineScheduleStatus;
    private computeLoanStatistics;
    create(data: CreateLoanAccountDto, createdBy: number): Promise<LoanAccount>;
    update(id: number, data: UpdateLoanAccountDto): Promise<LoanAccount>;
    findById(id: number): Promise<Record<string, unknown> | null>;
    updateAccountStatus(id: number, dto: UpdateLoanAccountStatusDto): Promise<void>;
    findAll(): Promise<LoanAccount[]>;
    findRelatedAdmins(): Promise<{
        id: number;
        username: string | null;
        role: import("@prisma/client").$Enums.ManagementRoles;
        nickname: string | null;
    }[]>;
    private buildListWhereConditions;
    findGroupedByUser(query: {
        page: number;
        pageSize: number;
        status?: string;
        adminId?: string;
        keyword?: string;
        username?: string;
        listFilter?: string;
    }, currentUser?: {
        id: number;
        role: string;
    }): Promise<{
        data: Record<string, unknown>[];
        total: number;
        relatedAdmins: {
            id: number;
            username: string | null;
            role: import("@prisma/client").$Enums.ManagementRoles;
            nickname: string | null;
        }[];
        listFilterCounts: {
            history: number;
            overdue: number;
            today_paid: number;
            today_unpaid: number;
        };
    }>;
    findListStats(query: {
        status?: string;
        adminId?: string;
        keyword?: string;
        username?: string;
        listFilter?: string;
    }, currentUser?: {
        id: number;
        role: string;
    }): Promise<{
        statistics: {
            inStock: number;
            remainingDebt: number;
            handlingFee: number;
            fines: number;
            todayReceived: number;
            yesterdayReceived: number;
        };
        dayScheduleBoard: {
            paid: number;
            pending: number;
            active: number;
        };
    }>;
}
