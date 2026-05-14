"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("./auth.guard");
const current_user_decorator_1 = require("./current-user.decorator");
const prisma_service_1 = require("../prisma/prisma.service");
const response_helper_1 = require("../common/response-helper");
const jwt_service_1 = require("./jwt.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
let AuthController = class AuthController {
    prisma;
    authJwtService;
    constructor(prisma, authJwtService) {
        this.prisma = prisma;
        this.authJwtService = authJwtService;
    }
    async verify(user) {
        if (!user) {
            return response_helper_1.ResponseHelper.error('未登录', 401);
        }
        const admin = await this.prisma.admin.findUnique({
            where: { id: user.id },
            select: { id: true, username: true, nickname: true, role: true },
        });
        if (!admin) {
            return response_helper_1.ResponseHelper.error('用户不存在', 404);
        }
        return response_helper_1.ResponseHelper.success({ code: 200, message: '验证成功', valid: true, data: admin }, '验证成功');
    }
    async refresh(req, res, bodyRefreshToken) {
        const refreshToken = req.cookies?.refresh_token ?? bodyRefreshToken ?? undefined;
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('Refresh token不存在');
        }
        const payload = this.authJwtService.verifyRefreshToken(refreshToken);
        if (!payload) {
            throw new common_1.UnauthorizedException('Refresh token无效或已过期');
        }
        const admin = await this.prisma.admin.findUnique({
            where: { id: payload.id },
            select: { id: true, openid: true, role: true, token_version: true },
        });
        if (!admin) {
            throw new common_1.UnauthorizedException('用户不存在');
        }
        if (payload.tokenVersion !== admin.token_version) {
            throw new common_1.UnauthorizedException('Token已失效，请重新登录');
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
        res.cookie('access_token', newAccessToken, cookieOptions);
        res.cookie('refresh_token', newRefreshToken, refreshCookieOptions);
        return response_helper_1.ResponseHelper.success({
            token: newAccessToken,
            refreshToken: newRefreshToken,
            message: 'Token刷新成功',
        }, 'Token刷新成功');
    }
    async wechatLogin(code, nickname, avatar_url, req, res) {
        if (!code) {
            throw new common_1.BadRequestException('缺失微信登录凭证');
        }
        const appId = process.env.APP_ID;
        const appSecret = process.env.APP_SECRET;
        if (!appId || !appSecret) {
            throw new common_1.UnauthorizedException('服务器未配置微信登录');
        }
        const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
        const response = await fetch(wxUrl);
        const data = await response.json();
        if (data.errcode) {
            throw new common_1.UnauthorizedException(`微信授权失败: ${data.errmsg}`);
        }
        const openid = data.openid;
        let admin = await this.prisma.admin.findUnique({
            where: { openid },
        });
        if (!admin) {
            admin = await this.prisma.admin.create({
                data: {
                    role: 'PENDING',
                    openid,
                    nickname,
                    avatar_url,
                },
            });
        }
        else {
            if (nickname || avatar_url) {
                admin = await this.prisma.admin.update({
                    where: { openid },
                    data: {
                        nickname: nickname || admin.nickname,
                        avatar_url: avatar_url || admin.avatar_url,
                    },
                });
            }
        }
        const accessToken = this.authJwtService.generateAccessToken({
            id: admin.id,
            openid: admin.openid ?? '',
            role: admin.role,
        });
        const refreshToken = this.authJwtService.generateRefreshToken({
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
        res.cookie('access_token', accessToken, cookieOptions);
        res.cookie('refresh_token', refreshToken, refreshCookieOptions);
        return response_helper_1.ResponseHelper.success({
            id: admin.id,
            openid: admin.openid,
            role: admin.role,
            nickname: admin.nickname,
            username: admin.username,
            avatar_url: admin.avatar_url,
            token: accessToken,
            refreshToken,
        }, '登录成功');
    }
    async uploadAvatar(avatarBase64) {
        if (!avatarBase64) {
            throw new common_1.BadRequestException('缺少头像数据');
        }
        const matches = avatarBase64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            throw new common_1.BadRequestException('头像数据格式错误');
        }
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64Data = matches[2];
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        return response_helper_1.ResponseHelper.success({ avatarUrl: `/uploads/avatars/${fileName}` }, '上传成功');
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('verify'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, common_1.Body)('refresh_token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('wechat-login'),
    __param(0, (0, common_1.Body)('code')),
    __param(1, (0, common_1.Body)('nickname')),
    __param(2, (0, common_1.Body)('avatar_url')),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "wechatLogin", null);
__decorate([
    (0, common_1.Post)('upload-avatar'),
    __param(0, (0, common_1.Body)('avatarBase64')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "uploadAvatar", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_service_1.AuthJwtService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map