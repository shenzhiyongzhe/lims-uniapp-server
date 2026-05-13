import { AdminsService } from './admins.service';
import { ManagementRoles } from '@prisma/client';
import { ApiResponseDto } from '../common/dto/api-response.dto';
export declare class AdminsController {
    private readonly adminsService;
    constructor(adminsService: AdminsService);
    findAll(): Promise<ApiResponseDto>;
    updateRole(id: string, role: ManagementRoles): Promise<ApiResponseDto>;
    remove(id: string): Promise<ApiResponseDto>;
}
