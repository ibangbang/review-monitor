import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentWorkspace } from '../../common/decorators/current.decorators';
import { WorkspaceRoles } from '../../common/decorators/workspace-roles.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { WorkspaceRolesGuard } from '../../common/guards/workspace-roles.guard';
import type { WorkspaceContext } from '../../common/types/request.types';
import {
  CreateStoreConnectionDto,
  StoreConnectionQueryDto,
  UpdateStoreConnectionDto,
} from './stores.dto';
import { StoreConnectionsService } from './store-connections.service';

@Controller('store-connections')
@UseGuards(WorkspaceGuard, WorkspaceRolesGuard)
export class StoreConnectionsController {
  constructor(private readonly connections: StoreConnectionsService) {}

  @Get()
  async list(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: StoreConnectionQueryDto,
  ) {
    return this.connections.list(workspace.id, query);
  }

  @Post()
  @WorkspaceRoles('owner', 'admin')
  async create(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Body() dto: CreateStoreConnectionDto,
  ) {
    return this.connections.create(workspace.id, dto);
  }

  @Patch(':id')
  @WorkspaceRoles('owner', 'admin')
  async update(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
    @Body() dto: UpdateStoreConnectionDto,
  ) {
    return this.connections.update(workspace.id, id, dto);
  }

  @Delete(':id')
  @WorkspaceRoles('owner', 'admin')
  @HttpCode(204)
  async remove(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
  ) {
    await this.connections.remove(workspace.id, id);
  }

  @Post(':id/validate')
  @WorkspaceRoles('owner', 'admin')
  @HttpCode(200)
  async validate(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
  ) {
    return this.connections.validate(workspace.id, id);
  }
}
