import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthJwtService } from './jwt.service';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  user: { id: number; role: string };
  clientId?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authJwtService: AuthJwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    // 优先使用JWT token验证
    let accessToken = request.cookies?.access_token as string | undefined;
    const refreshToken = request.cookies?.refresh_token as string | undefined;

    // 如果cookie中没有token，尝试从Authorization header中获取
    if (!accessToken) {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.split(' ')[1];
      }
    }

    if (accessToken) {
      // 验证Access Token
      const payload = this.authJwtService.verifyAccessToken(accessToken);

      if (payload) {
        // Token有效，检查是否即将过期（滑动过期机制）
        if (this.authJwtService.isTokenExpiringSoon(accessToken)) {
          // Token即将过期，尝试自动刷新
          await this.attemptTokenRefresh(refreshToken, response);
        }

        // 从数据库验证用户和token版本；role 始终取自 DB，不信 JWT
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

        request.user = { id: staff.id, role: staff.role };
        return true;
      } else if (refreshToken) {
        // Access Token无效，尝试使用Refresh Token刷新
        const refreshed = await this.attemptTokenRefresh(
          refreshToken,
          response,
        );
        if (refreshed) {
          const refreshPayload =
            this.authJwtService.verifyRefreshToken(refreshToken);
          if (refreshPayload) {
            const staff = await this.prisma.staff.findUnique({
              where: { id: refreshPayload.id },
              select: {
                id: true,
                openid: true,
                role: true,
                token_version: true,
              },
            });

            if (
              staff &&
              typeof refreshPayload.tokenVersion === 'number' &&
              refreshPayload.tokenVersion === staff.token_version
            ) {
              request.user = { id: staff.id, role: staff.role };
              return true;
            }
          }
        }
      }
    }
    throw new UnauthorizedException('未登录或token已过期');
  }

  // 尝试刷新token
  private async attemptTokenRefresh(
    refreshToken: string | undefined,
    response: Response,
  ): Promise<boolean> {
    if (!refreshToken) {
      return false;
    }

    const payload = this.authJwtService.verifyRefreshToken(refreshToken);
    if (!payload) {
      return false;
    }

    // 从数据库验证token version
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.id },
      select: { id: true, openid: true, role: true, token_version: true },
    });

    if (
      !staff ||
      typeof payload.tokenVersion !== 'number' ||
      staff.token_version !== payload.tokenVersion
    ) {
      return false;
    }

    // 生成新的tokens（不含 role；role 由 AuthGuard 从 DB 注入）
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

    // 更新cookies（滑动过期）
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('strict' as const) : ('lax' as const),
      path: '/',
      maxAge: 15 * 60 * 1000, // Access Token: 15分钟
    };

    const refreshCookieOptions = {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // Refresh Token: 7天（滑动过期）
    };

    response.cookie('access_token', newAccessToken, cookieOptions);
    response.cookie('refresh_token', newRefreshToken, refreshCookieOptions);

    return true;
  }
}
