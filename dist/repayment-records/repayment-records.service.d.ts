import { PrismaService } from '../prisma/prisma.service';
import { RepaymentRecordResponseDto } from './dto/repayment-record-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CollectorSummaryQueryDto } from './dto/collector-summary-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';
type DailyLoanBalanceItemType = 'YESTERDAY_DUE_LOAN' | 'TODAY_REPAY' | 'TODAY_EARLY_SETTLEMENT';
type DailyLoanBalanceItem = {
    loanId: number;
    amount: number;
    type: DailyLoanBalanceItemType;
    label: string;
    isEarlySettlement: boolean;
    remark: string;
};
type DailyLoanBalanceResult = {
    previousTotal: number;
    yesterdayLoanTotal: number;
    todayRepaidTotal: number;
    todayTotal: number;
    yesterdayLoanItems: DailyLoanBalanceItem[];
    todayRepaidItems: DailyLoanBalanceItem[];
    expression: {
        yesterdayLoans: string;
        todayRepayments: string;
        summary: string;
    };
    date: string;
    adminId: number;
};
export declare class RepaymentRecordsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllWithPagination(query: PaginationQueryDto, adminId: number): Promise<any>;
    getCollectorSummary(query: CollectorSummaryQueryDto, adminId: number): Promise<{
        monthAmount: number;
        yesterdayAmount: number;
        todayAmount: number;
        todayCount: number;
        totalAmount: number;
        dailyLoanBalance: DailyLoanBalanceResult;
    }>;
    getDailyLoanBalance(params: {
        adminId: number;
        targetDate?: Date;
        scopeCollectorAdminId?: number;
        persist?: boolean;
    }): Promise<DailyLoanBalanceResult>;
    upsertDailyLoanBalanceForDate(adminId: number, targetDate: Date): Promise<DailyLoanBalanceResult>;
    getDailySummary(query: DailySummaryQueryDto, adminId: number): Promise<{
        date: string;
        totalPaidAmount: number;
        count: number;
    }[]>;
    private getScopedLoanIds;
    private getDayStart;
    private getDayEnd;
    private getBusinessDate;
    private formatNumber;
    private formatSigned;
    private formatExpression;
    toResponse(record: any): RepaymentRecordResponseDto;
}
export {};
