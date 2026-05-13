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
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
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
                nickname: true,
                role: true,
                openid: true,
                avatar_url: true,
                createdAt: true,
            },
        });
    }
    async updateRole(id, role) {
        return this.prisma.$transaction(async (tx) => {
            const admin = await tx.admin.update({
                where: { id },
                data: { role },
            });
            if (role === client_1.ManagementRoles.COLLECTOR) {
                await tx.collectorAssetManagement.upsert({
                    where: { admin_id: id },
                    update: {},
                    create: { admin_id: id },
                });
            }
            if (role === client_1.ManagementRoles.RISK_CONTROLLER) {
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