import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { DomainException } from '../../common/errors/domain.exception';
import type { AuthUser } from '../../common/types/request.types';
import { newPublicId } from '../../common/utils/id';
import {
  User,
  Workspace,
  WorkspaceMember,
} from '../../database/entities';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspaces.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Workspace) private readonly workspaces: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private readonly members: Repository<WorkspaceMember>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async listForUser(user: AuthUser) {
    const memberships = await this.members.find({
      where: { userId: user.id, status: 'active' },
      order: { joinedAt: 'ASC' },
    });
    const workspaceIds = memberships.map((membership) => membership.workspaceId);
    const rows = workspaceIds.length
      ? await this.workspaces.find({ where: { id: In(workspaceIds), status: 'active' } })
      : [];
    const byId = new Map(rows.map((workspace) => [workspace.id, workspace]));
    return memberships
      .map((membership) => {
        const workspace = byId.get(membership.workspaceId);
        if (!workspace) return null;
        return {
          publicId: workspace.publicId,
          name: workspace.name,
          role: membership.role,
          joinedAt: membership.joinedAt,
          createdAt: workspace.createdAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  async create(user: AuthUser, dto: CreateWorkspaceDto) {
    return this.dataSource.transaction(async (manager) => {
      const workspace = manager.create(Workspace, {
        publicId: newPublicId(),
        name: dto.name.trim(),
        ownerUserId: user.id,
        status: 'active',
      });
      await manager.save(workspace);
      await manager.save(
        manager.create(WorkspaceMember, {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'owner',
          status: 'active',
          joinedAt: new Date(),
        }),
      );
      return {
        publicId: workspace.publicId,
        name: workspace.name,
        role: 'owner' as const,
        joinedAt: new Date(),
        createdAt: workspace.createdAt,
      };
    });
  }

  async detail(workspaceId: string, role: string) {
    const workspace = await this.workspaces.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw DomainException.notFound('WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    const memberCount = await this.members.count({
      where: { workspaceId, status: 'active' },
    });
    return {
      publicId: workspace.publicId,
      name: workspace.name,
      role,
      memberCount,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  async update(workspaceId: string, dto: UpdateWorkspaceDto) {
    const workspace = await this.workspaces.findOne({ where: { id: workspaceId } });
    if (!workspace) {
      throw DomainException.notFound('WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    if (dto.name !== undefined) workspace.name = dto.name.trim();
    await this.workspaces.save(workspace);
    return {
      publicId: workspace.publicId,
      name: workspace.name,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  async listMembers(workspaceId: string) {
    const members = await this.members.find({
      where: { workspaceId, status: 'active' },
      order: { joinedAt: 'ASC' },
    });
    const userIds = members.map((member) => member.userId);
    const users = userIds.length ? await this.users.find({ where: { id: In(userIds) } }) : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    return members.map((member) => {
      const user = byId.get(member.userId);
      return {
        userPublicId: user?.publicId ?? null,
        email: user?.email ?? null,
        displayName: user?.displayName ?? null,
        role: member.role,
        joinedAt: member.joinedAt,
      };
    });
  }
}
