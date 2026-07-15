import { AuthJwtService } from './jwt.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthJwtService Scheme A', () => {
  let service: AuthJwtService;

  beforeEach(() => {
    const jwtService = new JwtService({});
    const configService = {
      get: (key: string) => {
        if (key === 'JWT_SECRET') return 'test-access-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        return undefined;
      },
    } as ConfigService;
    service = new AuthJwtService(jwtService, configService);
  });

  it('access token has tokenVersion and no role claim', () => {
    const token = service.generateAccessToken({
      id: 7,
      openid: 'openid-x',
      tokenVersion: 3,
    });
    const payload = service.verifyAccessToken(token);
    expect(payload).toMatchObject({
      id: 7,
      openid: 'openid-x',
      type: 'access',
      tokenVersion: 3,
    });
    expect(payload && 'role' in payload ? (payload as { role?: string }).role : undefined).toBeUndefined();
  });

  it('refresh token has tokenVersion and no role claim', () => {
    const token = service.generateRefreshToken({
      id: 7,
      openid: 'openid-x',
      tokenVersion: 3,
    });
    const payload = service.verifyRefreshToken(token);
    expect(payload).toMatchObject({
      id: 7,
      openid: 'openid-x',
      type: 'refresh',
      tokenVersion: 3,
    });
    expect(payload && 'role' in payload ? (payload as { role?: string }).role : undefined).toBeUndefined();
  });
});
