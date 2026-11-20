import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { verify } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entities';
import { DomainException } from '../errors/domain.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AppRequest } from '../types/request.types';

export const ACCESS_COOKIE = 'rm_access';

interface AccessTokenPayload {
  sub: string;
  type: string;
  email?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    const token = extractToken(request);
    if (!token) {
      throw DomainException.unauthorized('AUTH_REQUIRED', 'Authentication required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = verify(token, this.config.get<string>('JWT_ACCESS_SECRET') as string, {
        algorithms: ['HS256'],
      }) as AccessTokenPayload;
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw DomainException.unauthorized(
        expired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_INVALID_TOKEN',
        expired ? 'Access token expired' : 'Invalid access token',
      );
    }

    if (payload.type !== 'access' || !payload.sub) {
      throw DomainException.unauthorized('AUTH_INVALID_TOKEN', 'Invalid access token');
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') {
      throw DomainException.unauthorized('AUTH_USER_DISABLED', 'User is not available');
    }

    request.user = {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      displayName: user.displayName,
    };
    return true;
  }
}

function extractToken(request: AppRequest): string | undefined {
  const header = request.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookies = (request as { cookies?: Record<string, string> }).cookies;
  return cookies?.[ACCESS_COOKIE];
}
