import { PrismaService } from '../prisma/prisma.service';
import { RepaymentRecordResponseDto } from './dto/repayment-record-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CollectorSummaryQueryDto } from './dto/collector-summary-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';
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
    }>;
    getDailySummary(query: DailySummaryQueryDto, adminId: number): Promise<{
        date: string;
        totalPaidAmount: number;
        count: number;
    }[]>;
    private getScopedLoanIds;
    private getDayStart;
    private getDayEnd;
    toResponse(record: any): RepaymentRecordResponseDto;
}
