import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentAdmin } from '../../common/decorators/current.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import type { AdminContext } from '../../common/types/request.types';
import {
  AdminApplicationQueryDto,
  AdminAuditLogQueryDto,
  AdminNotificationQueryDto,
  AdminReviewQueryDto,
  AdminTaskQueryDto,
  AdminUserQueryDto,
  AdminWorkspaceQueryDto,
} from './admin.dto';
import { AdminService, type AdminAuditMeta } from './admin.service';

function auditMeta(admin: AdminContext, request: Request): AdminAuditMeta {
  return {
    adminUserId: admin.id,
    ip: request.ip,
    userAgent: request.header('user-agent'),
  };
}

@Controller('admin')
@Public()
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  listUsers(@Query() query: AdminUserQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get('workspaces')
  listWorkspaces(@Query() query: AdminWorkspaceQueryDto) {
    return this.admin.listWorkspaces(query);
  }

  @Get('applications')
  listApplications(@Query() query: AdminApplicationQueryDto) {
    return this.admin.listApplications(query);
  }

  @Get('reviews')
  listReviews(@Query() query: AdminReviewQueryDto) {
    return this.admin.listReviews(query);
  }

  @Get('review-tasks')
  listTasks(@Query() query: AdminTaskQueryDto) {
    return this.admin.listTasks(query);
  }

  @Get('review-tasks/:id')
  taskDetail(@Param('id') id: string) {
    return this.admin.taskDetail(id);
  }

  @Post('review-tasks/:id/retry')
  @HttpCode(200)
  retryTask(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() request: Request,
  ) {
    return this.admin.retryTask(id, auditMeta(admin, request));
  }

  @Get('integrations')
  integrations() {
    return this.admin.integrations();
  }

  @Get('notifications')
  listNotifications(@Query() query: AdminNotificationQueryDto) {
    return this.admin.listNotifications(query);
  }

  @Post('notifications/:id/retry')
  @HttpCode(200)
  retryNotification(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminContext,
    @Req() request: Request,
  ) {
    return this.admin.retryNotification(id, auditMeta(admin, request));
  }

  @Get('system-health')
  systemHealth() {
    return this.admin.systemHealth();
  }

  @Get('audit-logs')
  listAuditLogs(@Query() query: AdminAuditLogQueryDto) {
    return this.admin.listAuditLogs(query);
  }
}
