import { RepaymentRecordsService } from './repayment-records.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CollectorSummaryQueryDto } from './dto/collector-summary-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';
export declare class RepaymentRecordsController {
    private readonly repaymentRecordsService;
    constructor(repaymentRecordsService: RepaymentRecordsService);
    findAll(query: PaginationQueryDto, user: any): Promise<{
        code: number;
        message: string;
        data: any;
    }>;
    getCollectorSummary(query: CollectorSummaryQueryDto, user: any): Promise<{
        code: number;
        message: string;
        data: {
            monthAmount: number;
            yesterdayAmount: number;
            todayAmount: number;
            todayCount: number;
            totalAmount: number;
        };
    }>;
    getDailySummary(query: DailySummaryQueryDto, user: any): Promise<{
        code: number;
        message: string;
        data: {
            date: string;
            totalPaidAmount: number;
            count: number;
        }[];
    }>;
}
