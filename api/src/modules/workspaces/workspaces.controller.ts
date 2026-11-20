import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  CurrentWorkspace,
} from '../../common/decorators/current.decorators';
import { WorkspaceRoles } from '../../common/decorators/workspace-roles.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceRolesGuard } from '../../common/guards/workspace-roles.guard';
import type { AuthUser, WorkspaceContext } from '../../common/types/request.types';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './workspaces.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.workspaces.listForUser(user);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user, dto);
  }
}

@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceGuard, WorkspaceRolesGuard)
export class WorkspaceDetailController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  async detail(@CurrentWorkspace() workspace: WorkspaceContext) {
    return this.workspaces.detail(workspace.id, workspace.role);
  }

  @Patch()
  @WorkspaceRoles('owner', 'admin')
  async update(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(workspace.id, dto);
  }

  @Get('members')
  async members(@CurrentWorkspace() workspace: WorkspaceContext) {
    return this.workspaces.listMembers(workspace.id);
  }
}
