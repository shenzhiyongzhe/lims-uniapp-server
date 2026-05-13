import { StatisticsService } from './statistics.service';
import { GetStatisticsDto } from './dto/get-statistics.dto';
export declare class StatisticsController {
    private readonly statisticsService;
    constructor(statisticsService: StatisticsService);
    getStatistics(query: GetStatisticsDto & {
        riskControllerId?: string;
        collectorId?: string;
        roleType?: string;
        adminId?: string;
    }, user: {
        id: number;
        role: string;
    }): Promise<{
        code: number;
        message: string;
        data: any;
    } | undefined>;
    getAdminStatistics(): Promise<{
        code: number;
        message: string;
        data: any[];
    }>;
}
