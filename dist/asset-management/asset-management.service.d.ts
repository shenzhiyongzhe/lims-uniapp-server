import { OnModuleInit } from '@nestjs/common';
import { LoanAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCollectorAssetDto } from './dto/update-collector-asset.dto';
import { UpdateRiskControllerAssetDto } from './dto/update-risk-controller-asset.dto';
export declare class AssetManagementService implements OnModuleInit {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    findCollectorAsset(adminId: number): Promise<{
        id: number;
        admin_id: number;
        admin: {
            id: number;
            username: string | null;
            nickname: string | null;
        } | null;
        remaining_handling_fee: number;
        remaining_fines: number;
        reduced_handling_fee: number;
        reduced_fines: number;
    }>;
    findAllCollectorAssets(): Promise<{
        id: number;
        admin_id: number;
        admin: {
            id: number;
            username: string | null;
            nickname: string | null;
        } | null;
        remaining_handling_fee: number;
        remaining_fines: number;
        reduced_handling_fee: number;
        reduced_fines: number;
    }[]>;
    findRiskControllerAsset(adminId: number): Promise<{
        id: number;
        admin_id: number;
        admin: {
            id: number;
            username: string | null;
            nickname: string | null;
        } | null;
        remaining_amount: number;
        reduced_amount: number;
    }>;
    findAllRiskControllerAssets(): Promise<{
        id: number;
        admin_id: number;
        admin: {
            id: number;
            username: string | null;
            nickname: string | null;
        } | null;
        remaining_amount: number;
        reduced_amount: number;
    }[]>;
    updateCollectorAsset(adminId: number, dto: UpdateCollectorAssetDto): Promise<{
        id: number;
        created_at: Date;
        updated_at: Date;
        total_fines: import("@prisma/client/runtime/library").Decimal;
        reduced_handling_fee: import("@prisma/client/runtime/library").Decimal;
        reduced_fines: import("@prisma/client/runtime/library").Decimal;
        admin_id: number;
        total_handling_fee: import("@prisma/client/runtime/library").Decimal;
    }>;
    updateRiskControllerAsset(adminId: number, dto: UpdateRiskControllerAssetDto): Promise<{
        id: number;
        created_at: Date;
        updated_at: Date;
        reduced_amount: import("@prisma/client/runtime/library").Decimal;
        admin_id: number;
        total_amount: import("@prisma/client/runtime/library").Decimal;
    }>;
    updateCollectorAssetFromLoanAccount(adminId: number, _loanAccount: LoanAccount): Promise<void>;
    updateRiskControllerAssetFromLoanAccount(adminId: number, _loanAccount: LoanAccount): Promise<void>;
    private getCollectorLoanAccountIds;
    private calculateTotalAmounts;
}
