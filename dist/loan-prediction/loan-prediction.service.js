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
exports.LoanPredictionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let LoanPredictionService = class LoanPredictionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPredictions(fieldName, prefix) {
        if (prefix && prefix.trim() !== '') {
            if (fieldName === 'to_hand_ratio') {
                const allPredictions = await this.prisma.loanFieldPrediction.findMany({
                    where: { field_name: fieldName },
                    orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
                });
                const filtered = allPredictions
                    .filter((p) => {
                    const percentValue = String(Number(p.value) * 100);
                    return percentValue.startsWith(prefix);
                })
                    .slice(0, 3);
                return filtered.map((p) => ({
                    value: Number(p.value),
                    frequency: p.frequency,
                }));
            }
            else {
                const allPredictions = await this.prisma.loanFieldPrediction.findMany({
                    where: { field_name: fieldName },
                    orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
                });
                const filtered = allPredictions
                    .filter((p) => {
                    const valueStr = String(Number(p.value));
                    return valueStr.startsWith(prefix);
                })
                    .slice(0, 3);
                return filtered.map((p) => ({
                    value: Number(p.value),
                    frequency: p.frequency,
                }));
            }
        }
        else {
            const predictions = await this.prisma.loanFieldPrediction.findMany({
                where: { field_name: fieldName },
                orderBy: [{ frequency: 'desc' }, { last_used_at: 'desc' }],
                take: 3,
            });
            return predictions.map((p) => ({
                value: Number(p.value),
                frequency: p.frequency,
            }));
        }
    }
    async recordFieldUsage(fieldName, value) {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue <= 0)
            return;
        await this.prisma.loanFieldPrediction.upsert({
            where: {
                field_name_value: {
                    field_name: fieldName,
                    value: numValue,
                },
            },
            update: {
                frequency: { increment: 1 },
                last_used_at: new Date(),
            },
            create: {
                field_name: fieldName,
                value: numValue,
                frequency: 1,
                last_used_at: new Date(),
            },
        });
    }
    async updatePredictions(loanAccount) {
        const fieldsToUpdate = [
            { name: 'loan_amount', value: loanAccount.loan_amount },
            { name: 'to_hand_ratio', value: loanAccount.to_hand_ratio },
            { name: 'capital', value: loanAccount.capital },
            { name: 'interest', value: loanAccount.interest },
            { name: 'company_cost', value: loanAccount.company_cost },
            { name: 'handling_fee', value: loanAccount.handling_fee },
        ];
        await Promise.all(fieldsToUpdate.map(async (field) => {
            if (field.value === null || field.value === undefined)
                return;
            await this.recordFieldUsage(field.name, field.value.toString());
        }));
    }
};
exports.LoanPredictionService = LoanPredictionService;
exports.LoanPredictionService = LoanPredictionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LoanPredictionService);
//# sourceMappingURL=loan-prediction.service.js.map