import { PrismaService } from '../prisma/prisma.service';
export declare class MobileTerminalService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private toNumber;
    getTopStatistics(): Promise<{
        risk_controller_total_amount: number;
        collector_total_reduction: number;
        remaining_funds: number;
    }>;
    getPayees(): Promise<{
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
    }>;
}
