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
exports.AdminsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminsService = class AdminsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.admin.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                nickname: true,
                role: true,
                openid: true,
                avatar_url: true,
                createdAt: true,
            },
        });
    }
    async updateRole(id, role) {
        return this.updateAdmin(id, { role });
    }
    async updateAdmin(id, dto) {
        const roleProvided = dto.role !== undefined;
        const usernameProvided = dto.username !== undefined;
        if (!roleProvided && !usernameProvided) {
            throw new common_1.BadRequestException('至少提供 username 或 role 之一');
        }
        let normalizedUsername;
        if (usernameProvided) {
            const s = dto.username == null ? '' : String(dto.username).trim();
            normalizedUsername = s.length === 0 ? null : s;
            if (normalizedUsername && normalizedUsername.length > 10) {
                throw new common_1.BadRequestException('用户名最多 10 个字符');
            }
        }
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.admin.findUnique({ where: { id } });
            if (!existing) {
                throw new common_1.NotFoundException(`管理员不存在: ${id}`);
            }
            const data = {};
            if (usernameProvided) {
                data.username = normalizedUsername ?? null;
            }
            if (roleProvided && dto.role !== undefined) {
                data.role = dto.role;
            }
            const admin = await tx.admin.update({
                where: { id },
                data,
            });
            if (roleProvided && dto.role === client_1.ManagementRoles.COLLECTOR) {
                await tx.collectorAssetManagement.upsert({
                    where: { admin_id: id },
                    update: {},
                    create: { admin_id: id },
                });
            }
            if (roleProvided && dto.role === client_1.ManagementRoles.RISK_CONTROLLER) {
                await tx.riskControllerAssetManagement.upsert({
                    where: { admin_id: id },
                    update: {},
                    create: { admin_id: id },
                });
            }
            return admin;
        });
    }
    async remove(id) {
        return this.prisma.admin.delete({
            where: { id },
        });
    }
};
exports.AdminsService = AdminsService;
exports.AdminsService = AdminsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminsService);
//# sourceMappingURL=admins.service.js.map