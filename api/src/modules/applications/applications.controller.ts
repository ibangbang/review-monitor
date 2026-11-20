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
  ApplicationQueryDto,
  CreateApplicationDto,
  CreateStoreAppDto,
  StoreAppQueryDto,
  UpdateApplicationDto,
  UpdateStoreAppDto,
} from './applications.dto';
import { ApplicationsService } from './applications.service';

@Controller()
@UseGuards(WorkspaceGuard, WorkspaceRolesGuard)
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get('applications')
  async list(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: ApplicationQueryDto,
  ) {
    return this.applications.list(workspace.id, query);
  }

  @Post('applications')
  @WorkspaceRoles('owner', 'admin')
  async create(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applications.create(workspace.id, dto);
  }

  @Get('applications/:id')
  async detail(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
  ) {
    return this.applications.detail(workspace.id, id);
  }

  @Patch('applications/:id')
  @WorkspaceRoles('owner', 'admin')
  async update(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applications.update(workspace.id, id, dto);
  }

  @Delete('applications/:id')
  @WorkspaceRoles('owner', 'admin')
  @HttpCode(204)
  async archive(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
  ) {
    await this.applications.archive(workspace.id, id);
  }

  @Get('applications/:id/store-apps')
  async listStoreApps(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
    @Query() query: StoreAppQueryDto,
  ) {
    return this.applications.listStoreApps(workspace.id, id, query);
  }

  @Post('applications/:id/store-apps')
  @WorkspaceRoles('owner', 'admin')
  async addStoreApp(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
    @Body() dto: CreateStoreAppDto,
  ) {
    return this.applications.addStoreApp(workspace.id, id, dto);
  }

  @Patch('store-apps/:id')
  @WorkspaceRoles('owner', 'admin')
  async updateStoreApp(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
    @Body() dto: UpdateStoreAppDto,
  ) {
    return this.applications.updateStoreApp(workspace.id, id, dto);
  }

  @Delete('store-apps/:id')
  @WorkspaceRoles('owner', 'admin')
  @HttpCode(204)
  async removeStoreApp(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
  ) {
    await this.applications.removeStoreApp(workspace.id, id);
  }
}
