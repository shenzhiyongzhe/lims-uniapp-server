import { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthJwtService } from './jwt.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuthGuard implements CanActivate {
    private readonly authJwtService;
    private readonly prisma;
    constructor(authJwtService: AuthJwtService, prisma: PrismaService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private attemptTokenRefresh;
}
