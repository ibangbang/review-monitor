import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace, WorkspaceMember } from '../../database/entities/workspace.entities';
import { DomainException } from '../errors/domain.exception';
import type { AppRequest } from '../types/request.types';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    @InjectRepository(Workspace) private readonly workspaces: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private readonly members: Repository<WorkspaceMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (!request.user) {
      throw DomainException.unauthorized();
    }

    const paramWorkspaceId = request.params.workspaceId;
    const publicId =
      request.header('x-workspace-id') ??
      (Array.isArray(paramWorkspaceId) ? paramWorkspaceId[0] : paramWorkspaceId);
    if (!publicId) {
      throw DomainException.badRequest(
        'WORKSPACE_REQUIRED',
        'X-Workspace-Id header is required',
      );
    }

    const workspace = await this.workspaces.findOne({ where: { publicId } });
    if (!workspace || workspace.status !== 'active') {
      throw DomainException.notFound('WORKSPACE_NOT_FOUND', 'Workspace not found');
    }

    const member = await this.members.findOne({
      where: { workspaceId: workspace.id, userId: request.user.id, status: 'active' },
    });
    if (!member) {
      throw DomainException.forbidden(
        'WORKSPACE_ACCESS_DENIED',
        'You do not have access to this workspace',
      );
    }

    request.workspace = {
      id: workspace.id,
      publicId: workspace.publicId,
      name: workspace.name,
      role: member.role,
    };
    return true;
  }
}
