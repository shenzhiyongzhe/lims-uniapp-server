import { PrismaService } from '../prisma/prisma.service';
import { LoanAccount } from '@prisma/client';
export declare class LoanPredictionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getPredictions(fieldName: string, prefix?: string): Promise<Array<{
        value: number;
        frequency: number;
    }>>;
    recordFieldUsage(fieldName: string, value: string): Promise<void>;
    updatePredictions(loanAccount: LoanAccount): Promise<void>;
}
