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
exports.AuthJwtService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
let AuthJwtService = class AuthJwtService {
    jwtService;
    configService;
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
    }
    generateAccessToken(payload) {
        const tokenPayload = {
            ...payload,
            type: 'access',
        };
        return this.jwtService.sign(tokenPayload, {
            expiresIn: '15m',
            secret: this.configService.get('JWT_SECRET') ||
                'your-secret-key-change-in-production',
        });
    }
    generateRefreshToken(payload) {
        const tokenPayload = {
            id: payload.id,
            openid: payload.openid,
            role: payload.role,
            type: 'refresh',
        };
        return this.jwtService.sign({ ...tokenPayload, tokenVersion: payload.tokenVersion }, {
            expiresIn: '7d',
            secret: this.configService.get('JWT_REFRESH_SECRET') ||
                'your-refresh-secret-key-change-in-production',
        });
    }
    verifyAccessToken(token) {
        try {
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET') ||
                    'your-secret-key-change-in-production',
            });
            if (payload.type !== 'access') {
                return null;
            }
            return payload;
        }
        catch (error) {
            return null;
        }
    }
    verifyRefreshToken(token) {
        try {
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_REFRESH_SECRET') ||
                    'your-refresh-secret-key-change-in-production',
            });
            if (payload.type !== 'refresh') {
                return null;
            }
            return payload;
        }
        catch (error) {
            return null;
        }
    }
    isTokenExpiringSoon(token) {
        try {
            const decoded = this.jwtService.decode(token);
            if (!decoded || !decoded.exp) {
                return true;
            }
            const expirationTime = decoded.exp * 1000;
            const currentTime = Date.now();
            const timeUntilExpiry = expirationTime - currentTime;
            const fiveMinutes = 5 * 60 * 1000;
            return timeUntilExpiry < fiveMinutes;
        }
        catch (error) {
            return true;
        }
    }
};
exports.AuthJwtService = AuthJwtService;
exports.AuthJwtService = AuthJwtService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], AuthJwtService);
//# sourceMappingURL=jwt.service.js.map