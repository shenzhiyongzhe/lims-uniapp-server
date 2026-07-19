import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const DEFAULT_PIN = '1234';
const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 10;

@Injectable()
export class PinService {
  constructor(private readonly prisma: PrismaService) {}

  /** 将明文 PIN 哈希（bcrypt） */
  private async hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pin, BCRYPT_ROUNDS);
  }

  /** 比较明文 PIN 与哈希 */
  private async comparePin(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * 获取指定 staff 的密码锁状态
   * 返回：pin_enabled, is_default_pin, is_locked, locked_until
   */
  async getPinStatus(staffId: number) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        pin_enabled: true,
        is_default_pin: true,
        locked_until: true,
        failed_login_attempts: true,
      },
    });

    if (!staff) throw new NotFoundException('用户不存在');

    const now = new Date();
    const isLocked = !!(staff.locked_until && staff.locked_until > now);

    return {
      pin_enabled: staff.pin_enabled,
      is_default_pin: staff.is_default_pin,
      is_locked: isLocked,
      locked_until: isLocked ? staff.locked_until : null,
      failed_attempts: staff.failed_login_attempts,
    };
  }

  /**
   * 验证 PIN 码
   * - 若账号被锁定，抛出 ForbiddenException
   * - 若验证成功，清空失败次数，更新 last_login_at
   * - 若验证失败，累计失败次数；满 3 次则锁定 1 小时
   * 返回：{ success, is_default_pin, remaining_attempts? }
   */
  async verifyPin(staffId: number, inputPin: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        pin_enabled: true,
        pin_hash: true,
        is_default_pin: true,
        failed_login_attempts: true,
        locked_until: true,
      },
    });

    if (!staff) throw new NotFoundException('用户不存在');
    if (!staff.pin_enabled)
      throw new BadRequestException('密码解锁功能未开启');

    const now = new Date();

    // 检查是否锁定
    if (staff.locked_until && staff.locked_until > now) {
      const remainMs = staff.locked_until.getTime() - now.getTime();
      const remainMin = Math.ceil(remainMs / 60000);
      throw new ForbiddenException(
        `账号已锁定，请 ${remainMin} 分钟后再试`,
      );
    }

    // 锁定已过期，重置
    if (staff.locked_until && staff.locked_until <= now) {
      await this.prisma.staff.update({
        where: { id: staffId },
        data: { failed_login_attempts: 0, locked_until: null },
      });
      staff.failed_login_attempts = 0;
      staff.locked_until = null;
    }

    // 若尚未设置 pin_hash，使用默认密码
    const hashToCompare =
      staff.pin_hash ?? (await this.hashPin(DEFAULT_PIN));
    const isMatch = await this.comparePin(inputPin, hashToCompare);

    if (isMatch) {
      // 验证成功
      await this.prisma.staff.update({
        where: { id: staffId },
        data: {
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: now,
          // 确保 pin_hash 持久化（首次验证默认密码时存入）
          pin_hash: staff.pin_hash ?? hashToCompare,
        },
      });
      return {
        success: true,
        is_default_pin: staff.is_default_pin,
      };
    }

    // 验证失败
    const newAttempts = (staff.failed_login_attempts ?? 0) + 1;
    const shouldLock = newAttempts >= MAX_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + LOCK_DURATION_MS)
      : null;

    await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        failed_login_attempts: newAttempts,
        locked_until: lockedUntil,
      },
    });

    if (shouldLock) {
      throw new ForbiddenException(
        `密码连续错误 ${MAX_ATTEMPTS} 次，账号已锁定 1 小时`,
      );
    }

    return {
      success: false,
      remaining_attempts: MAX_ATTEMPTS - newAttempts,
    };
  }

  /**
   * 用户修改自己的 PIN 码
   * - 需提供旧密码验证
   * - 新旧密码不能相同
   */
  async changePin(staffId: number, oldPin: string, newPin: string) {
    if (!newPin || !/^\d{4}$/.test(newPin)) {
      throw new BadRequestException('新密码必须为4位数字');
    }
    if (oldPin === newPin) {
      throw new BadRequestException('新密码不能与旧密码相同');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        pin_enabled: true,
        pin_hash: true,
        failed_login_attempts: true,
        locked_until: true,
      },
    });

    if (!staff) throw new NotFoundException('用户不存在');
    if (!staff.pin_enabled)
      throw new BadRequestException('密码解锁功能未开启');

    // 锁定检查
    const now = new Date();
    if (staff.locked_until && staff.locked_until > now) {
      const remainMs = staff.locked_until.getTime() - now.getTime();
      const remainMin = Math.ceil(remainMs / 60000);
      throw new ForbiddenException(`账号已锁定，请 ${remainMin} 分钟后再试`);
    }

    // 验证旧密码
    const hashToCompare =
      staff.pin_hash ?? (await this.hashPin(DEFAULT_PIN));
    const isMatch = await this.comparePin(oldPin, hashToCompare);

    if (!isMatch) {
      throw new BadRequestException('旧密码错误');
    }

    const newHash = await this.hashPin(newPin);
    await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        pin_hash: newHash,
        is_default_pin: false,
        failed_login_attempts: 0,
        locked_until: null,
      },
    });

    return { success: true };
  }

  /**
   * 管理员开启/关闭全局密码锁
   * - 开启时：若 pin_hash 为空则自动设置默认密码哈希
   * - 关闭时：清空锁定状态（但保留密码哈希，方便再次开启时恢复）
   */
  async toggleGlobalPin(enabled: boolean) {
    if (enabled) {
      // 对所有 pin_hash 为空的 staff 设置默认密码
      const defaultHash = await this.hashPin(DEFAULT_PIN);

      // 批量开启
      await this.prisma.staff.updateMany({
        data: { pin_enabled: true },
      });

      // 对尚未设置密码的 staff 初始化默认密码
      await this.prisma.staff.updateMany({
        where: { pin_hash: null },
        data: {
          pin_hash: defaultHash,
          is_default_pin: true,
        },
      });
    } else {
      // 全部关闭，并清空锁定状态
      await this.prisma.staff.updateMany({
        data: {
          pin_enabled: false,
          failed_login_attempts: 0,
          locked_until: null,
        },
      });
    }

    return { success: true, enabled };
  }

  /**
   * 管理员重置指定 staff 的密码为默认值 1234
   */
  async resetStaffPin(staffId: number) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException(`用户不存在 (ID: ${staffId})`);

    const defaultHash = await this.hashPin(DEFAULT_PIN);
    await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        pin_hash: defaultHash,
        is_default_pin: true,
        failed_login_attempts: 0,
        locked_until: null,
      },
    });

    return { success: true };
  }

  /**
   * 管理员解除指定 staff 的密码输入错误锁定
   */
  async unlockStaffPin(staffId: number) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException(`用户不存在 (ID: ${staffId})`);

    await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        failed_login_attempts: 0,
        locked_until: null,
      },
    });

    return { success: true };
  }
}
