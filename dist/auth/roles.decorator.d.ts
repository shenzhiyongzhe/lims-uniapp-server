import { ManagementRoles } from '@prisma/client';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: ManagementRoles[]) => import("@nestjs/common").CustomDecorator<string>;
