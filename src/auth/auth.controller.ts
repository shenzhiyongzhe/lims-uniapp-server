import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
  Body,
  BadRequestException,
  Put,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { AuthJwtService } from './jwt.service';
import { PinService } from './pin.service';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authJwtService: AuthJwtService,
    private readonly pinService: PinService,
  ) {}

  @Get('verify')
  @UseGuards(AuthGuard)
  async verify(
    @CurrentUser() user: { id: number; role: string } | null,
  ): Promise<ApiResponseDto<any>> {
    if (!user) {
      return ResponseHelper.error('未登录', 401);
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: user.id },
      select: { id: true, username: true, nickname: true, role: true },
    });
    if (!staff) {
      return ResponseHelper.error('用户不存在', 404);
    }
    return ResponseHelper.success(
      { code: 200, message: '验证成功', valid: true, data: staff },
      '验证成功',
    );
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refresh_token') bodyRefreshToken?: string,
  ): Promise<ApiResponseDto> {
    const refreshToken =
      req.cookies?.refresh_token ?? bodyRefreshToken ?? undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token不存在');
    }

    const payload = this.authJwtService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new UnauthorizedException('Refresh token无效或已过期');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.id },
      select: { id: true, openid: true, role: true, token_version: true },
    });

    if (!staff) {
      throw new UnauthorizedException('用户不存在');
    }

    if (
      typeof payload.tokenVersion !== 'number' ||
      payload.tokenVersion !== staff.token_version
    ) {
      throw new UnauthorizedException('Token已失效，请重新登录');
    }

    const newAccessToken = this.authJwtService.generateAccessToken({
      id: staff.id,
      openid: staff.openid ?? '',
      tokenVersion: staff.token_version,
    });

    const newRefreshToken = this.authJwtService.generateRefreshToken({
      id: staff.id,
      openid: staff.openid ?? '',
      tokenVersion: staff.token_version,
    });

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('strict' as const) : ('lax' as const),
      path: '/',
      maxAge: 15 * 60 * 1000,
    };

    const refreshCookieOptions = {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie('access_token', newAccessToken, cookieOptions);
    res.cookie('refresh_token', newRefreshToken, refreshCookieOptions);

    return ResponseHelper.success(
      {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        message: 'Token刷新成功',
      },
      'Token刷新成功',
    );
  }

  @Post('wechat-login')
  async wechatLogin(
    @Body('code') code: string,
    @Body('nickname') nickname: string,
    @Body('avatar_url') avatar_url: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponseDto> {
    if (!code) {
      throw new BadRequestException('缺失微信登录凭证');
    }

    const appId = process.env.APP_ID;
    const appSecret = process.env.APP_SECRET;

    if (!appId || !appSecret) {
      throw new UnauthorizedException('服务器未配置微信登录');
    }

    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    const response = await fetch(wxUrl);
    const data = await response.json();

    if (data.errcode) {
      throw new UnauthorizedException(`微信授权失败: ${data.errmsg}`);
    }

    const openid = data.openid;

    let staff = await this.prisma.staff.findUnique({
      where: { openid },
    });

    if (!staff) {
      staff = await this.prisma.staff.create({
        data: {
          role: 'PENDING',
          openid,
          nickname: nickname || '微信用户',
          username: nickname ? nickname.slice(0, 10).trim() : null,
          avatar_url: avatar_url || null,
        },
      });
    } else {
      if (nickname || avatar_url) {
        staff = await this.prisma.staff.update({
          where: { openid },
          data: {
            nickname: nickname || staff.nickname,
            avatar_url: avatar_url || staff.avatar_url,
          },
        });
      }
    }

    const accessToken = this.authJwtService.generateAccessToken({
      id: staff.id,
      openid: staff.openid ?? '',
      tokenVersion: staff.token_version,
    });

    const refreshToken = this.authJwtService.generateRefreshToken({
      id: staff.id,
      openid: staff.openid ?? '',
      tokenVersion: staff.token_version,
    });

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('strict' as const) : ('lax' as const),
      path: '/',
      maxAge: 15 * 60 * 1000,
    };
    const refreshCookieOptions = {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie('access_token', accessToken, cookieOptions);
    res.cookie('refresh_token', refreshToken, refreshCookieOptions);

    return ResponseHelper.success(
      {
        id: staff.id,
        openid: staff.openid,
        role: staff.role,
        nickname: staff.nickname,
        username: staff.username,
        avatar_url: staff.avatar_url,
        token: accessToken,
        refreshToken,
      },
      '登录成功',
    );
  }

  @Put('profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @CurrentUser() user: { id: number },
    @Body('nickname') nickname?: string,
    @Body('avatar_url') avatar_url?: string,
  ): Promise<ApiResponseDto> {
    const updateData: any = {};
    if (nickname !== undefined) {
      updateData.nickname = nickname;
      updateData.username = nickname ? nickname.slice(0, 10).trim() : null;
    }
    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url;
    }

    const updated = await this.prisma.staff.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        openid: true,
        role: true,
        nickname: true,
        username: true,
        avatar_url: true,
      },
    });

    return ResponseHelper.success(updated, '更新个人信息成功');
  }

  @Post('upload-avatar')
  async uploadAvatar(
    @Body('avatarBase64') avatarBase64: string,
  ): Promise<ApiResponseDto> {
    if (!avatarBase64) {
      throw new BadRequestException('缺少头像数据');
    }

    const matches = avatarBase64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new BadRequestException('头像数据格式错误');
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

    return ResponseHelper.success(
      { avatarUrl: `/uploads/avatars/${fileName}` },
      '上传成功',
    );
  }

  // ─── PIN 密码锁 API ────────────────────────────────────────────────

  /** 获取当前用户密码锁状态 */
  @Get('pin/status')
  @UseGuards(AuthGuard)
  async getPinStatus(
    @CurrentUser() user: { id: number },
  ): Promise<ApiResponseDto> {
    const status = await this.pinService.getPinStatus(user.id);
    return ResponseHelper.success(status, '获取密码锁状态成功');
  }

  /** 用户验证 PIN 码（用于解锁） */
  @Post('pin/verify')
  @UseGuards(AuthGuard)
  async verifyPin(
    @CurrentUser() user: { id: number },
    @Body('pin') pin: string,
  ): Promise<ApiResponseDto> {
    if (!pin || !/^\d{4}$/.test(pin)) {
      throw new BadRequestException('请输入4位数字密码');
    }
    const result = await this.pinService.verifyPin(user.id, pin);
    return ResponseHelper.success(
      result,
      result.success ? '验证成功' : '密码错误',
    );
  }

  /** 用户修改自己的 PIN 码 */
  @Put('pin/change')
  @UseGuards(AuthGuard)
  async changePin(
    @CurrentUser() user: { id: number },
    @Body('old_pin') oldPin: string,
    @Body('new_pin') newPin: string,
  ): Promise<ApiResponseDto> {
    if (!oldPin || !newPin) {
      throw new BadRequestException('请提供旧密码和新密码');
    }
    const result = await this.pinService.changePin(user.id, oldPin, newPin);
    return ResponseHelper.success(result, '密码修改成功');
  }
}
