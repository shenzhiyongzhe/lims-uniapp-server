import { AssetManagementService } from './asset-management.service';
import { UpdateCollectorAssetDto } from './dto/update-collector-asset.dto';
import { UpdateRiskControllerAssetDto } from './dto/update-risk-controller-asset.dto';
export declare class AssetManagementController {
    private readonly assetManagementService;
    constructor(assetManagementService: AssetManagementService);
    getAllCollectorAssets(): Promise<{
        code: number;
        message: string;
        data: {
            id: number;
            admin_id: number;
            admin: {
                id: number;
                nickname: string | null;
            } | null;
            remaining_handling_fee: number;
            remaining_fines: number;
            reduced_handling_fee: number;
            reduced_fines: number;
        }[];
    }>;
    getAllRiskControllerAssets(): Promise<{
        code: number;
        message: string;
        data: {
            id: number;
            admin_id: number;
            admin: {
                id: number;
                nickname: string | null;
            } | null;
            remaining_amount: number;
            reduced_amount: number;
        }[];
    }>;
    getCollectorAsset(adminId: string): Promise<{
        code: number;
        message: string;
        data: {
            id: number;
            admin_id: number;
            admin: {
                id: number;
                nickname: string | null;
            } | null;
            remaining_handling_fee: number;
            remaining_fines: number;
            reduced_handling_fee: number;
            reduced_fines: number;
        };
    }>;
    getRiskControllerAsset(adminId: string): Promise<{
        code: number;
        message: string;
        data: {
            id: number;
            admin_id: number;
            admin: {
                id: number;
                nickname: string | null;
            } | null;
            remaining_amount: number;
            reduced_amount: number;
        };
    }>;
    updateCollectorAsset(adminId: string, dto: UpdateCollectorAssetDto): Promise<{
        code: number;
        message: string;
        data: {
            id: number;
            created_at: Date;
            updated_at: Date;
            total_fines: import("@prisma/client/runtime/library").Decimal;
            reduced_handling_fee: import("@prisma/client/runtime/library").Decimal;
            reduced_fines: import("@prisma/client/runtime/library").Decimal;
            admin_id: number;
            total_handling_fee: import("@prisma/client/runtime/library").Decimal;
        };
    }>;
    updateRiskControllerAsset(adminId: string, dto: UpdateRiskControllerAssetDto): Promise<{
        code: number;
        message: string;
        data: {
            id: number;
            created_at: Date;
            updated_at: Date;
            reduced_amount: import("@prisma/client/runtime/library").Decimal;
            admin_id: number;
            total_amount: import("@prisma/client/runtime/library").Decimal;
        };
    }>;
}
