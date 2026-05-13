import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
export interface TokenPayload {
    id: number;
    openid: string;
    role: string;
    type: 'access' | 'refresh';
}
export declare class AuthJwtService {
    private readonly jwtService;
    private readonly configService;
    constructor(jwtService: JwtService, configService: ConfigService);
    generateAccessToken(payload: {
        id: number;
        openid: string;
        role: string;
    }): string;
    generateRefreshToken(payload: {
        id: number;
        openid: string;
        role: string;
        tokenVersion: number;
    }): string;
    verifyAccessToken(token: string): TokenPayload | null;
    verifyRefreshToken(token: string): (TokenPayload & {
        tokenVersion: number;
    }) | null;
    isTokenExpiringSoon(token: string): boolean;
}
