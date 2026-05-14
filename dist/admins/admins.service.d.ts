import { ManagementRoles } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAdminDto } from './dto/update-admin.dto';
export declare class AdminsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: number;
        openid: string | null;
        username: string | null;
        role: import("@prisma/client").$Enums.ManagementRoles;
        nickname: string | null;
        avatar_url: string | null;
        createdAt: Date;
    }[]>;
    updateRole(id: number, role: ManagementRoles): Promise<{
        id: number;
        openid: string | null;
        username: string | null;
        role: import("@prisma/client").$Enums.ManagementRoles;
        nickname: string | null;
        avatar_url: string | null;
        createdAt: Date;
        updatedAt: Date | null;
        failed_login_attempts: number;
        locked_until: Date | null;
        last_login_at: Date | null;
        last_login_ip: string | null;
        token_version: number;
    }>;
    updateAdmin(id: number, dto: UpdateAdminDto): Promise<{
        id: number;
        openid: string | null;
        username: string | null;
        role: import("@prisma/client").$Enums.ManagementRoles;
        nickname: string | null;
        avatar_url: string | null;
        createdAt: Date;
        updatedAt: Date | null;
        failed_login_attempts: number;
        locked_until: Date | null;
        last_login_at: Date | null;
        last_login_ip: string | null;
        token_version: number;
    }>;
    remove(id: number): Promise<{
        id: number;
        openid: string | null;
        username: string | null;
        role: import("@prisma/client").$Enums.ManagementRoles;
        nickname: string | null;
        avatar_url: string | null;
        createdAt: Date;
        updatedAt: Date | null;
        failed_login_attempts: number;
        locked_until: Date | null;
        last_login_at: Date | null;
        last_login_ip: string | null;
        token_version: number;
    }>;
}
