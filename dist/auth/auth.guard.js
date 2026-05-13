"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_service_1 = require("./jwt.service");
const prisma_service_1 = require("../prisma/prisma.service");
let AuthGuard = class AuthGuard {
    authJwtService;
    prisma;
    constructor(authJwtService, prisma) {
        this.authJwtService = authJwtService;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        let accessToken = request.cookies?.access_token;
        const refreshToken = request.cookies?.refresh_token;
        if (!accessToken) {
            const authHeader = request.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                accessToken = authHeader.split(' ')[1];
            }
        }
        if (accessToken) {
            const payload = this.authJwtService.verifyAccessToken(accessToken);
            if (payload) {
                if (this.authJwtService.isTokenExpiringSoon(accessToken)) {
                    await this.attemptTokenRefresh(refreshToken, response, payload);
                }
                const admin = await this.prisma.admin.findUnique({
                    where: { id: payload.id },
                    select: { id: true, openid: true, role: true, token_version: true },
                });
                if (!admin) {
                    throw new common_1.UnauthorizedException('用户不存在');
                }
                request.user = { id: admin.id, role: admin.role };
                return true;
            }
            else if (refreshToken) {
                const refreshed = await this.attemptTokenRefresh(refreshToken, response);
                if (refreshed) {
                    const refreshPayload = this.authJwtService.verifyRefreshToken(refreshToken);
                    if (refreshPayload) {
                        const admin = await this.prisma.admin.findUnique({
                            where: { id: refreshPayload.id },
                            select: { id: true, openid: true, role: true },
                        });
                        if (admin) {
                            request.user = { id: admin.id, role: admin.role };
                            return true;
                        }
                    }
                }
            }
        }
        throw new common_1.UnauthorizedException('未登录或token已过期');
    }
    async attemptTokenRefresh(refreshToken, response, currentPayload) {
        if (!refreshToken) {
            return false;
        }
        const payload = this.authJwtService.verifyRefreshToken(refreshToken);
        if (!payload) {
            return false;
        }
        const admin = await this.prisma.admin.findUnique({
            where: { id: payload.id },
            select: { id: true, openid: true, role: true, token_version: true },
        });
        if (!admin || admin.token_version !== payload.tokenVersion) {
            return false;
        }
        const newAccessToken = this.authJwtService.generateAccessToken({
            id: admin.id,
            openid: admin.openid ?? '',
            role: admin.role,
        });
        const newRefreshToken = this.authJwtService.generateRefreshToken({
            id: admin.id,
            openid: admin.openid ?? '',
            role: admin.role,
            tokenVersion: admin.token_version,
        });
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            path: '/',
            maxAge: 15 * 60 * 1000,
        };
        const refreshCookieOptions = {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        };
        response.cookie('access_token', newAccessToken, cookieOptions);
        response.cookie('refresh_token', newRefreshToken, refreshCookieOptions);
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_service_1.AuthJwtService,
        prisma_service_1.PrismaService])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map