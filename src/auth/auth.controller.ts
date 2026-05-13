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
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseHelper } from '../common/response-helper';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { AuthJwtService } from './jwt.service';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authJwtService: AuthJwtService,
  ) {}

  @Get('verify')
  @UseGuards(AuthGuard)
  async verify(
    @CurrentUser() user: { id: number; role: string } | null,
  ): Promise<ApiResponseDto<any>> {
    if (!user) {
      return ResponseHelper.error('未登录', 401);
    }

    if (user.role === 'ADMIN') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: user.id },
        select: { id: true, nickname: true, role: true },
      });
      if (!admin) {
        return ResponseHelper.error('用户不存在', 404);
      }
      return ResponseHelper.success(
        { code: 200, message: '验证成功', valid: true, data: admin },
        '验证成功',
      );
    }
    return ResponseHelper.success(
      { code: 200, message: '验证成功', valid: true, data: user },
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

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.id },
      select: { id: true, openid: true, role: true, token_version: true },
    });

    if (!admin) {
      throw new UnauthorizedException('用户不存在');
    }

    if (payload.tokenVersion !== admin.token_version) {
      throw new UnauthorizedException('Token已失效，请重新登录');
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
    const data = await response.json() as any;

    if (data.errcode) {
      throw new UnauthorizedException(`微信授权失败: ${data.errmsg}`);
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
    } else {
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
        id: admin.id,
        openid: admin.openid,
        role: admin.role,
        nickname: admin.nickname,
        avatar_url: admin.avatar_url,
        token: accessToken,
        refreshToken,
      },
      '登录成功',
    );
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
}
