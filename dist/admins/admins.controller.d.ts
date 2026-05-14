import { AdminsService } from './admins.service';
import { ManagementRoles } from '@prisma/client';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
export declare class AdminsController {
    private readonly adminsService;
    constructor(adminsService: AdminsService);
    findAll(): Promise<ApiResponseDto>;
    updateAdmin(id: string, body: UpdateAdminDto): Promise<ApiResponseDto>;
    updateRole(id: string, role: ManagementRoles): Promise<ApiResponseDto>;
    remove(id: string): Promise<ApiResponseDto>;
}
