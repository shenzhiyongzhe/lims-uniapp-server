import { PrismaService } from '../prisma/prisma.service';
export declare class StatisticsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private getBusinessDayStart;
    private getBusinessDayEnd;
    getCollectorDetailedStatisticsForAdmin(adminId: number, roleType: 'collector' | 'risk_controller', targetDate?: Date, selectedAdminId?: number): Promise<any>;
    private getAllCollectorsStatisticsSum;
    private getAllRiskControllersStatisticsSum;
    private sumStatistics;
    private getEmptyStatisticsWithYesterday;
    getCollectorDetailedStatisticsForCollector(adminId: number, roleType: 'collector' | 'risk_controller', targetDate?: Date, riskControllerId?: number, collectorId?: number): Promise<any>;
    private getCollectorDetailedStatisticsInternal;
    getAdminStatistics(): Promise<any[]>;
    private getEmptyStatistics;
}
