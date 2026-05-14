import { PrismaService } from '../prisma/prisma.service';
import { LoanAccount } from '@prisma/client';
export type LoanPredictionItem = {
    value: number;
    frequency: number;
} | {
    value: string;
    frequency: number;
};
export declare class LoanPredictionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getPredictions(fieldName: string, prefix?: string): Promise<LoanPredictionItem[]>;
    recordFieldUsage(fieldName: string, value: string): Promise<void>;
    updatePredictions(loanAccount: LoanAccount): Promise<void>;
}
