import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ManagementRoles } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.staff.findMany({
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

  async updateRole(id: number, role: ManagementRoles) {
    return this.updateStaff(id, { role });
  }

  async updateStaff(id: number, dto: UpdateStaffDto) {
    const roleProvided = dto.role !== undefined;
    const usernameProvided = dto.username !== undefined;

    if (!roleProvided && !usernameProvided) {
      throw new BadRequestException('至少提供 username 或 role 之一');
    }

    let normalizedUsername: string | null | undefined;
    if (usernameProvided) {
      const s = dto.username == null ? '' : String(dto.username).trim();
      normalizedUsername = s.length === 0 ? null : s;
      if (normalizedUsername && normalizedUsername.length > 10) {
        throw new BadRequestException('用户名最多 10 个字符');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.staff.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`业务人员不存在: ${id}`);
      }

      const data: { username?: string | null; role?: ManagementRoles } = {};
      if (usernameProvided) {
        data.username = normalizedUsername ?? null;
      }
      if (roleProvided && dto.role !== undefined) {
        data.role = dto.role;
      }

      const staff = await tx.staff.update({
        where: { id },
        data,
      });

      if (roleProvided && dto.role === ManagementRoles.COLLECTOR) {
        await tx.collectorAssetManagement.upsert({
          where: { admin_id: id },
          update: {},
          create: { admin_id: id },
        });
      }

      if (roleProvided && dto.role === ManagementRoles.RISK_CONTROLLER) {
        await tx.riskControllerAssetManagement.upsert({
          where: { admin_id: id },
          update: {},
          create: { admin_id: id },
        });
      }

      return staff;
    });
  }

  async remove(id: number) {
    return this.prisma.staff.delete({
      where: { id },
    });
  }

  async migrateStaffData(fromId: number, toId: number) {
    if (fromId === toId) {
      throw new BadRequestException('源员工与目标员工不能相同');
    }

    return this.prisma.$transaction(async (tx) => {
      const fromStaff = await tx.staff.findUnique({ where: { id: fromId } });
      const toStaff = await tx.staff.findUnique({ where: { id: toId } });

      if (!fromStaff) {
        throw new NotFoundException(`源员工不存在 (ID: ${fromId})`);
      }
      if (!toStaff) {
        throw new NotFoundException(`目标员工不存在 (ID: ${toId})`);
      }

      if (fromStaff.role !== toStaff.role) {
        throw new BadRequestException(
          `角色不匹配：源员工为 ${fromStaff.role}，目标员工为 ${toStaff.role}，无法迁移`,
        );
      }

      const role = fromStaff.role;

      if (role === ManagementRoles.COLLECTOR) {
        // 1. 迁移 LoanAccount (collector_id)
        await tx.loanAccount.updateMany({
          where: { collector_id: fromId },
          data: { collector_id: toId },
        });

        // 2. 迁移 RepaymentRecord (actual_collector_id)
        await tx.repaymentRecord.updateMany({
          where: { actual_collector_id: fromId },
          data: { actual_collector_id: toId },
        });

        // 3. 合并 CollectorAssetManagement
        const fromAsset = await tx.collectorAssetManagement.findUnique({
          where: { admin_id: fromId },
        });
        if (fromAsset) {
          const toAsset = await tx.collectorAssetManagement.upsert({
            where: { admin_id: toId },
            update: {},
            create: { admin_id: toId },
          });

          await tx.collectorAssetManagement.update({
            where: { admin_id: toId },
            data: {
              total_handling_fee: Number(toAsset.total_handling_fee) + Number(fromAsset.total_handling_fee),
              total_fines: Number(toAsset.total_fines) + Number(fromAsset.total_fines),
              reduced_handling_fee: Number(toAsset.reduced_handling_fee) + Number(fromAsset.reduced_handling_fee),
              reduced_fines: Number(toAsset.reduced_fines) + Number(fromAsset.reduced_fines),
              deposit: Number(toAsset.deposit) + Number(fromAsset.deposit),
            },
          });

          // 删除源员工的资产记录
          await tx.collectorAssetManagement.delete({
            where: { admin_id: fromId },
          });
        }

        // 4. 迁移 AssetReductionHistory (admin_id & updated_by_admin_id)
        await tx.assetReductionHistory.updateMany({
          where: { admin_id: fromId },
          data: { admin_id: toId },
        });
        await tx.assetReductionHistory.updateMany({
          where: { updated_by_admin_id: fromId },
          data: { updated_by_admin_id: toId },
        });

      } else if (role === ManagementRoles.RISK_CONTROLLER) {
        // 1. 迁移 LoanAccount (risk_controller_id)
        await tx.loanAccount.updateMany({
          where: { risk_controller_id: fromId },
          data: { risk_controller_id: toId },
        });

        // 2. 合并 RiskControllerAssetManagement
        const fromAsset = await tx.riskControllerAssetManagement.findUnique({
          where: { admin_id: fromId },
        });
        if (fromAsset) {
          const toAsset = await tx.riskControllerAssetManagement.upsert({
            where: { admin_id: toId },
            update: {},
            create: { admin_id: toId },
          });

          await tx.riskControllerAssetManagement.update({
            where: { admin_id: toId },
            data: {
              total_amount: Number(toAsset.total_amount) + Number(fromAsset.total_amount),
              reduced_amount: Number(toAsset.reduced_amount) + Number(fromAsset.reduced_amount),
            },
          });

          // 删除源员工的资产记录
          await tx.riskControllerAssetManagement.delete({
            where: { admin_id: fromId },
          });
        }
      }

      // 5. 迁移公共日志记录: RepaymentScheduleOperationLog & LoanAccountOperationLog
      await tx.repaymentScheduleOperationLog.updateMany({
        where: { operator_admin_id: fromId },
        data: { operator_admin_id: toId },
      });
      await tx.loanAccountOperationLog.updateMany({
        where: { operator_admin_id: fromId },
        data: { operator_admin_id: toId },
      });

      // 6. 合并 DailyLoanBalance
      const fromDaily = await tx.dailyLoanBalance.findMany({
        where: { admin_id: fromId },
      });
      for (const dayA of fromDaily) {
        const dayB = await tx.dailyLoanBalance.findUnique({
          where: {
            admin_id_date: {
              admin_id: toId,
              date: dayA.date,
            },
          },
        });

        if (dayB) {
          // 合并 JSON 数组 (today_loan_items, today_repaid_items)
          let mergedLoanItems: any[] = [];
          if (dayB.today_loan_items && Array.isArray(dayB.today_loan_items)) {
            mergedLoanItems = mergedLoanItems.concat(dayB.today_loan_items);
          }
          if (dayA.today_loan_items && Array.isArray(dayA.today_loan_items)) {
            mergedLoanItems = mergedLoanItems.concat(dayA.today_loan_items);
          }

          let mergedRepaidItems: any[] = [];
          if (dayB.today_repaid_items && Array.isArray(dayB.today_repaid_items)) {
            mergedRepaidItems = mergedRepaidItems.concat(dayB.today_repaid_items);
          }
          if (dayA.today_repaid_items && Array.isArray(dayA.today_repaid_items)) {
            mergedRepaidItems = mergedRepaidItems.concat(dayA.today_repaid_items);
          }

          await tx.dailyLoanBalance.update({
            where: { id: dayB.id },
            data: {
              previous_total: Number(dayB.previous_total) + Number(dayA.previous_total),
              today_loan_total: Number(dayB.today_loan_total) + Number(dayA.today_loan_total),
              today_repaid_total: Number(dayB.today_repaid_total) + Number(dayA.today_repaid_total),
              today_total: Number(dayB.today_total) + Number(dayA.today_total),
              today_loan_items: mergedLoanItems.length > 0 ? mergedLoanItems : undefined,
              today_repaid_items: mergedRepaidItems.length > 0 ? mergedRepaidItems : undefined,
            },
          });

          // 删除源记录
          await tx.dailyLoanBalance.delete({
            where: { id: dayA.id },
          });
        } else {
          // 没有冲突，直接修改 admin_id
          await tx.dailyLoanBalance.update({
            where: { id: dayA.id },
            data: { admin_id: toId },
          });
        }
      }

      // 7. 将源员工降级为 PENDING
      await tx.staff.update({
        where: { id: fromId },
        data: { role: ManagementRoles.PENDING },
      });

      return {
        success: true,
        message: '数据迁移成功，源员工已降级为待审核状态',
      };
    });
  }
}

