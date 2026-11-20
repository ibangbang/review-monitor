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
  ChannelQueryDto,
  CreateChannelDto,
  CreateRuleDto,
  NotificationHistoryQueryDto,
  RuleQueryDto,
  UpdateChannelDto,
  UpdateRuleDto,
} from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller()
@UseGuards(WorkspaceGuard, WorkspaceRolesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notification-channels')
  async listChannels(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: ChannelQueryDto,
  ) {
    return this.notifications.listChannels(workspace.id, query);
  }

  @Post('notification-channels')
  @WorkspaceRoles('owner', 'admin')
  async createChannel(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Body() dto: CreateChannelDto,
  ) {
    return this.notifications.createChannel(workspace.id, dto);
  }

  @Patch('notification-channels/:id')
  @WorkspaceRoles('owner', 'admin')
  async updateChannel(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.notifications.updateChannel(workspace.id, id, dto);
  }

  @Delete('notification-channels/:id')
  @WorkspaceRoles('owner', 'admin')
  @HttpCode(204)
  async removeChannel(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
  ) {
    await this.notifications.removeChannel(workspace.id, id);
  }

  @Post('notification-channels/:id/test')
  @WorkspaceRoles('owner', 'admin')
  @HttpCode(200)
  async testChannel(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
  ) {
    return this.notifications.testChannel(workspace.id, id);
  }

  @Get('notification-rules')
  async listRules(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: RuleQueryDto,
  ) {
    return this.notifications.listRules(workspace.id, query);
  }

  @Post('notification-rules')
  @WorkspaceRoles('owner', 'admin')
  async createRule(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Body() dto: CreateRuleDto,
  ) {
    return this.notifications.createRule(workspace.id, dto);
  }

  @Patch('notification-rules/:id')
  @WorkspaceRoles('owner', 'admin')
  async updateRule(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    return this.notifications.updateRule(workspace.id, id, dto);
  }

  @Delete('notification-rules/:id')
  @WorkspaceRoles('owner', 'admin')
  @HttpCode(204)
  async removeRule(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Param('id') id: string,
  ) {
    await this.notifications.removeRule(workspace.id, id);
  }

  @Get('notification-history')
  async history(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: NotificationHistoryQueryDto,
  ) {
    return this.notifications.history(workspace.id, query);
  }
}
