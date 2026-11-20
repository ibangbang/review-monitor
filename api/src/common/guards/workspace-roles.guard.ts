import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WorkspaceRole } from '../../database/entities/workspace.entities';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';
import { DomainException } from '../errors/domain.exception';
import type { AppRequest } from '../types/request.types';

@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<WorkspaceRole[]>(WORKSPACE_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    const workspace = request.workspace;
    if (!workspace) {
      throw DomainException.forbidden(
        'WORKSPACE_ACCESS_DENIED',
        'You do not have access to this workspace',
      );
    }
    if (!roles.includes(workspace.role)) {
      throw DomainException.forbidden(
        'WORKSPACE_ROLE_REQUIRED',
        'Your workspace role does not allow this action',
      );
    }
    return true;
  }
}
