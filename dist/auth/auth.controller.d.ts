import { PrismaService } from '../prisma/prisma.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { AuthJwtService } from './jwt.service';
import type { Request, Response } from 'express';
export declare class AuthController {
    private readonly prisma;
    private readonly authJwtService;
    constructor(prisma: PrismaService, authJwtService: AuthJwtService);
    verify(user: {
        id: number;
        role: string;
    } | null): Promise<ApiResponseDto<any>>;
    refresh(req: Request, res: Response, bodyRefreshToken?: string): Promise<ApiResponseDto>;
    wechatLogin(code: string, nickname: string, avatar_url: string, req: Request, res: Response): Promise<ApiResponseDto>;
    uploadAvatar(avatarBase64: string): Promise<ApiResponseDto>;
}
