import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { verify } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { AdminSession, AdminUser } from '../../database/entities/admin.entities';
import { DomainException } from '../errors/domain.exception';
import { hashToken } from '../../modules/auth/token.service';
import type { AppRequest } from '../types/request.types';

export const ADMIN_COOKIE = 'rm_admin';

interface AdminTokenPayload {
  sub: string;
  type: string;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
    @InjectRepository(AdminSession) private readonly sessions: Repository<AdminSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const token = extractToken(request);
    if (!token) {
      throw DomainException.unauthorized('ADMIN_AUTH_REQUIRED', 'Administrator authentication required');
    }

    let payload: AdminTokenPayload;
    try {
      payload = verify(token, this.config.get<string>('JWT_ADMIN_SECRET') as string, {
        algorithms: ['HS256'],
      }) as AdminTokenPayload;
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw DomainException.unauthorized(
        expired ? 'ADMIN_TOKEN_EXPIRED' : 'ADMIN_TOKEN_INVALID',
        expired ? 'Administrator token expired' : 'Invalid administrator token',
      );
    }

    if (payload.type !== 'admin' || !payload.sub) {
      throw DomainException.unauthorized('ADMIN_TOKEN_INVALID', 'Invalid administrator token');
    }

    const session = await this.sessions.findOne({ where: { tokenHash: hashToken(token) } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw DomainException.unauthorized('ADMIN_SESSION_INVALID', 'Administrator session is not valid');
    }
    if (String(session.adminUserId) !== String(payload.sub)) {
      throw DomainException.unauthorized('ADMIN_TOKEN_INVALID', 'Invalid administrator token');
    }

    const admin = await this.admins.findOne({ where: { id: payload.sub } });
    if (!admin || admin.status !== 'active') {
      throw DomainException.unauthorized('ADMIN_DISABLED', 'Administrator is not available');
    }

    request.admin = {
      id: admin.id,
      publicId: admin.publicId,
      email: admin.email,
      displayName: admin.displayName,
    };
    return true;
  }
}

function extractToken(request: AppRequest): string | undefined {
  const header = request.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookies = (request as { cookies?: Record<string, string> }).cookies;
  return cookies?.[ADMIN_COOKIE];
}
