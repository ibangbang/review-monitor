import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcryptjs';
import { IsNull, Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { DomainException } from '../../common/errors/domain.exception';
import { AdminSession, AdminUser, AuditLog } from '../../database/entities';
import { TokenService, hashToken } from '../auth/token.service';

export interface AdminLoginMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
    @InjectRepository(AdminSession) private readonly sessions: Repository<AdminSession>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
    private readonly tokens: TokenService,
  ) {}

  async login(dto: { email: string; password: string }, meta: AdminLoginMeta, res: Response) {
    const admin = await this.admins.findOne({ where: { email: dto.email.toLowerCase().trim() } });
    const valid = admin ? await compare(dto.password, admin.passwordHash) : false;
    if (!admin || !valid) {
      throw DomainException.unauthorized('ADMIN_INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (admin.status !== 'active') {
      throw DomainException.forbidden('ADMIN_DISABLED', 'Administrator is not available');
    }

    const issued = this.tokens.issueAdmin(admin.id, admin.email);
    await this.sessions.save(
      this.sessions.create({
        adminUserId: admin.id,
        tokenHash: hashToken(issued.token),
        expiresAt: issued.expiresAt,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      }),
    );
    admin.lastLoginAt = new Date();
    await this.admins.save(admin);
    await this.auditLogs.save(
      this.auditLogs.create({
        adminUserId: admin.id,
        actorType: 'admin',
        action: 'admin.login',
        resourceType: 'admin_user',
        resourceId: admin.publicId,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      }),
    );
    this.tokens.setAdminCookie(res, issued.token, issued.expiresAt);
    return {
      admin: this.toPublicAdmin(admin),
      accessExpiresAt: issued.expiresAt,
    };
  }

  async logout(request: Request, res: Response): Promise<void> {
    const token = extractAdminToken(request);
    if (token) {
      await this.sessions.update(
        { tokenHash: hashToken(token), revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    }
    this.tokens.clearAdminCookie(res);
  }

  async me(adminId: string) {
    const admin = await this.admins.findOne({ where: { id: adminId } });
    if (!admin) throw DomainException.unauthorized('ADMIN_TOKEN_INVALID', 'Administrator not found');
    return this.toPublicAdmin(admin);
  }

  private toPublicAdmin(admin: AdminUser) {
    return {
      id: admin.publicId,
      email: admin.email,
      displayName: admin.displayName,
      status: admin.status,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
    };
  }
}

export function extractAdminToken(request: Request): string | undefined {
  const header = request.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookies = (request as { cookies?: Record<string, string> }).cookies;
  return cookies?.rm_admin;
}
