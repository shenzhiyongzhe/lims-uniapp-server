import { PrismaService } from '../prisma/prisma.service';
import { LoanAccount } from '@prisma/client';
import { CreateLoanAccountDto } from './dto/create-loanAccount.dto';
import { UpdateLoanAccountDto } from './dto/update-loanAccount.dto';
import { LoanPredictionService } from '../loan-prediction/loan-prediction.service';
import { AssetManagementService } from '../asset-management/asset-management.service';
export declare class LoanAccountsService {
    private readonly prisma;
    private readonly loanPredictionService;
    private readonly assetManagementService;
    constructor(prisma: PrismaService, loanPredictionService: LoanPredictionService, assetManagementService: AssetManagementService);
    private isOverdue;
    private determineScheduleStatus;
    create(data: CreateLoanAccountDto, createdBy: number): Promise<LoanAccount>;
    update(id: number, data: UpdateLoanAccountDto): Promise<LoanAccount>;
    findById(id: number): Promise<LoanAccount | null>;
    findAll(): Promise<LoanAccount[]>;
    findRelatedAdmins(): Promise<{
        id: number;
        role: import("@prisma/client").$Enums.ManagementRoles;
        nickname: string | null;
    }[]>;
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
        data: ({
            user: {
                id: number;
                createdAt: Date;
                updatedAt: Date | null;
                username: string;
                overtime: number | null;
                overdue_time: number | null;
                is_high_risk: boolean | null;
            };
            collector: {
                id: number;
                nickname: string | null;
            };
            risk_controller: {
                id: number;
                nickname: string | null;
            };
            repaymentSchedules: {
                id: number;
                capital: import("@prisma/client/runtime/library").Decimal | null;
                interest: import("@prisma/client/runtime/library").Decimal | null;
                due_start_date: Date;
                status: import("@prisma/client").$Enums.RepaymentScheduleStatus;
                paid_capital: import("@prisma/client/runtime/library").Decimal | null;
                paid_interest: import("@prisma/client/runtime/library").Decimal | null;
                period: number;
                paid_amount: import("@prisma/client/runtime/library").Decimal | null;
                loan_id: number;
                due_amount: import("@prisma/client/runtime/library").Decimal;
                paid_at: Date | null;
                fines: import("@prisma/client/runtime/library").Decimal | null;
                collected_by_type: import("@prisma/client").$Enums.CollectionSource | null;
                operator_admin_id: number | null;
                operator_admin_name: string | null;
            }[];
        } & {
            id: number;
            user_id: number;
            loan_amount: import("@prisma/client/runtime/library").Decimal;
            to_hand_ratio: import("@prisma/client/runtime/library").Decimal | null;
            capital: import("@prisma/client/runtime/library").Decimal;
            interest: import("@prisma/client/runtime/library").Decimal;
            due_start_date: Date;
            due_end_date: Date;
            status: import("@prisma/client").$Enums.LoanAccountStatus;
            handling_fee: import("@prisma/client/runtime/library").Decimal;
            total_periods: number;
            repaid_periods: number;
            daily_repayment: number;
            risk_controller_id: number;
            collector_id: number;
            receiving_amount: import("@prisma/client/runtime/library").Decimal | null;
            company_cost: number;
            ownership: string | null;
            apply_times: number;
            note: string | null;
            created_at: Date;
            updated_at: Date | null;
            created_by: number;
            paid_capital: import("@prisma/client/runtime/library").Decimal;
            status_changed_at: Date | null;
            total_fines: import("@prisma/client/runtime/library").Decimal;
            paid_interest: import("@prisma/client/runtime/library").Decimal;
            early_settlement_capital: import("@prisma/client/runtime/library").Decimal | null;
            last_edit_fines: import("@prisma/client/runtime/library").Decimal | null;
            last_edit_pay_capital: import("@prisma/client/runtime/library").Decimal | null;
            last_edit_pay_interest: import("@prisma/client/runtime/library").Decimal | null;
            overdue_count: number;
        })[];
        total: number;
        statistics: {
            inStock: number;
            remainingDebt: number;
            handlingFee: number;
            fines: number;
            todayReceived: number;
            yesterdayReceived: number;
            todaySchedulePaidCount: number;
            todaySchedulePendingCount: number;
            todayScheduleActiveCount: number;
        };
        relatedAdmins: {
            id: number;
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
}
