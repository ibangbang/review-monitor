import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentWorkspace } from '../../common/decorators/current.decorators';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import type { WorkspaceContext } from '../../common/types/request.types';
import {
  AnalyticsRangeQueryDto,
  ComparisonQueryDto,
  DistributionQueryDto,
  SyncHealthQueryDto,
  TrendQueryDto,
} from './analytics.dto';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(WorkspaceGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  async overview(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: AnalyticsRangeQueryDto,
  ) {
    return this.analytics.overview(workspace.id, query);
  }

  @Get('reviews/trend')
  async trend(@CurrentWorkspace() workspace: WorkspaceContext, @Query() query: TrendQueryDto) {
    return this.analytics.trend(workspace.id, query);
  }

  @Get('reviews/distribution')
  async distribution(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: DistributionQueryDto,
  ) {
    return this.analytics.distribution(workspace.id, query);
  }

  @Get('applications/comparison')
  async comparison(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: ComparisonQueryDto,
  ) {
    return this.analytics.comparison(workspace.id, query);
  }

  @Get('sync-health')
  async syncHealth(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: SyncHealthQueryDto,
  ) {
    return this.analytics.syncHealth(workspace.id, query);
  }
}
