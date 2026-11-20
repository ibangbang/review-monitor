import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { newPublicId } from '../../common/utils/id';
import { DomainException } from '../../common/errors/domain.exception';
import {
  User,
  UserSession,
  Workspace,
  WorkspaceMember,
} from '../../database/entities';
import type { AuthUser } from '../../common/types/request.types';
import { LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto';
import { hashToken, IssuedTokens, TokenMeta, TokenService } from './token.service';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export interface SessionResult {
  user: PublicUser;
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tokenService: TokenService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserSession) private readonly sessions: Repository<UserSession>,
    @InjectRepository(Workspace) private readonly workspaces: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private readonly members: Repository<WorkspaceMember>,
  ) {}

  async register(dto: RegisterDto, meta: TokenMeta): Promise<SessionResult & { workspacePublicId: string }> {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.users.findOne({ where: { email } });
    if (exists) {
      throw DomainException.conflict('EMAIL_ALREADY_REGISTERED', 'This email is already registered');
    }

    const passwordHash = await hash(dto.password, 12);
    const created = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        publicId: newPublicId(),
        email,
        passwordHash,
        displayName: dto.displayName.trim(),
        status: 'active',
      });
      await manager.save(user);

      const workspace = manager.create(Workspace, {
        publicId: newPublicId(),
        name: dto.workspaceName?.trim() || `${dto.displayName.trim()} 的空间`,
        ownerUserId: user.id,
        status: 'active',
      });
      await manager.save(workspace);

      const member = manager.create(WorkspaceMember, {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
      });
      await manager.save(member);
      return { user, workspace };
    });

    const tokens = await this.createSession(created.user, meta);
    return {
      user: toPublicUser(created.user),
      tokens,
      workspacePublicId: created.workspace.publicId,
    };
  }

  async login(dto: LoginDto, meta: TokenMeta): Promise<SessionResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (!user || user.status !== 'active') {
      throw DomainException.unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    const valid = await compare(dto.password, user.passwordHash);
    if (!valid) {
      throw DomainException.unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    const tokens = await this.createSession(user, meta);
    return { user: toPublicUser(user), tokens };
  }

  async refresh(refreshToken: string | undefined, meta: TokenMeta): Promise<SessionResult> {
    if (!refreshToken) {
      throw DomainException.unauthorized('REFRESH_TOKEN_MISSING', 'Refresh token is missing');
    }
    const session = await this.sessions.findOne({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!session) {
      throw DomainException.unauthorized('REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
    }
    if (session.revokedAt) {
      // Token reuse after rotation: revoke every live session for this user.
      await this.sessions.update(
        { userId: session.userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw DomainException.unauthorized('REFRESH_TOKEN_REUSED', 'Session has been revoked');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw DomainException.unauthorized('REFRESH_TOKEN_EXPIRED', 'Refresh token expired');
    }

    const user = await this.users.findOne({ where: { id: session.userId } });
    if (!user || user.status !== 'active') {
      throw DomainException.unauthorized('AUTH_USER_DISABLED', 'User is not available');
    }

    const tokens = this.tokenService.issue(user.id, user.email);
    session.revokedAt = new Date();
    session.replacedByTokenHash = tokens.refreshTokenHash;
    await this.sessions.save(session);
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: tokens.refreshTokenHash,
        expiresAt: tokens.refreshExpiresAt,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      }),
    );
    return { user: toPublicUser(user), tokens };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.sessions.update(
      { tokenHash: hashToken(refreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async me(userId: string): Promise<{
    user: PublicUser;
    workspaces: Array<{ publicId: string; name: string; role: string; joinedAt: Date }>;
  }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw DomainException.unauthorized('AUTH_USER_DISABLED', 'User is not available');
    }
    const memberships = await this.members.find({
      where: { userId, status: 'active' },
      order: { joinedAt: 'ASC' },
    });
    const workspaceIds = memberships.map((membership) => membership.workspaceId);
    const workspaceRows = workspaceIds.length
      ? await this.workspaces.find({ where: { id: In(workspaceIds) } })
      : [];
    const byId = new Map(workspaceRows.map((workspace) => [workspace.id, workspace]));
    const workspaces = memberships
      .map((membership) => {
        const workspace = byId.get(membership.workspaceId);
        if (!workspace || workspace.status !== 'active') return null;
        return {
          publicId: workspace.publicId,
          name: workspace.name,
          role: membership.role,
          joinedAt: membership.joinedAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return { user: toPublicUser(user), workspaces };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw DomainException.unauthorized('AUTH_USER_DISABLED', 'User is not available');
    }
    user.displayName = dto.displayName.trim();
    await this.users.save(user);
    return toPublicUser(user);
  }

  async currentUser(userId: string): Promise<AuthUser> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw DomainException.unauthorized('AUTH_USER_DISABLED', 'User is not available');
    }
    return {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      displayName: user.displayName,
    };
  }

  private async createSession(user: User, meta: TokenMeta): Promise<IssuedTokens> {
    const tokens = this.tokenService.issue(user.id, user.email);
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: tokens.refreshTokenHash,
        expiresAt: tokens.refreshExpiresAt,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      }),
    );
    return tokens;
  }
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.publicId,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}
