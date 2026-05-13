import { MobileTerminalService } from './mobile-terminal.service';
import { RepaymentRecordsService } from '../repayment-records/repayment-records.service';
import { PaginationQueryDto } from '../repayment-records/dto/pagination-query.dto';
export declare class MobileTerminalController {
    private readonly mobileTerminalService;
    private readonly repaymentRecordsService;
    constructor(mobileTerminalService: MobileTerminalService, repaymentRecordsService: RepaymentRecordsService);
    getTopStatistics(): Promise<{
        code: number;
        message: string;
        data: {
            risk_controller_total_amount: number;
            collector_total_reduction: number;
            remaining_funds: number;
        };
    }>;
    getPayees(): Promise<{
        code: number;
        message: string;
        data: {
            payees: {
                id: number;
                admin_id: number;
                username: string;
                address: string;
                today_collection: number;
                monthly_collection: number;
                remaining_limit: number;
                is_disabled: boolean;
            }[];
            summary: {
                today_total: number;
                monthly_total: number;
                yesterday_total: number;
            };
        };
    }>;
    getRepaymentRecords(query: PaginationQueryDto, user: any): Promise<{
        code: number;
        message: string;
        data: any;
    }>;
}
