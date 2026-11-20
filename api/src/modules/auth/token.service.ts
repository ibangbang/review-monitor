import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import type { Response } from 'express';

export const ACCESS_COOKIE = 'rm_access';
export const REFRESH_COOKIE = 'rm_refresh';
export const ADMIN_COOKIE = 'rm_admin';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export interface TokenMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService) {}

  private get accessTtl(): number {
    return Number(this.config.get<string>('ACCESS_TOKEN_TTL', '900'));
  }

  private get refreshTtl(): number {
    return Number(this.config.get<string>('REFRESH_TOKEN_TTL', '2592000'));
  }

  issue(userId: string, email: string): IssuedTokens {
    const accessExpiresAt = new Date(Date.now() + this.accessTtl * 1000);
    const accessToken = sign({ sub: userId, email, type: 'access' }, this.secret('JWT_ACCESS_SECRET'), {
      algorithm: 'HS256',
      expiresIn: this.accessTtl,
    });
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtl * 1000);
    return {
      accessToken,
      refreshToken,
      refreshTokenHash: hashToken(refreshToken),
      accessExpiresAt,
      refreshExpiresAt,
    };
  }

  issueAdmin(adminId: string, email: string): { token: string; expiresAt: Date } {
    const ttl = this.accessTtl;
    return {
      token: sign({ sub: adminId, email, type: 'admin' }, this.secret('JWT_ADMIN_SECRET'), {
        algorithm: 'HS256',
        expiresIn: ttl,
      }),
      expiresAt: new Date(Date.now() + ttl * 1000),
    };
  }

  setAuthCookies(res: Response, tokens: IssuedTokens): void {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      expires: tokens.accessExpiresAt,
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      expires: tokens.refreshExpiresAt,
    });
  }

  clearAuthCookies(res: Response): void {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    res.clearCookie(ACCESS_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }

  setAdminCookie(res: Response, token: string, expiresAt: Date): void {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/v1/admin',
      expires: expiresAt,
    });
  }

  clearAdminCookie(res: Response): void {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    res.clearCookie(ADMIN_COOKIE, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/v1/admin',
    });
  }

  private secret(name: string): string {
    const value = this.config.get<string>(name);
    if (!value) throw new Error(`${name} is not configured`);
    return value;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
