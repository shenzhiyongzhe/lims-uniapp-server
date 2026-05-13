import { PrismaService } from '../prisma/prisma.service';
export declare class OverdueSweepService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    sweepYesterdayPendingToOverdue(): Promise<void>;
}
