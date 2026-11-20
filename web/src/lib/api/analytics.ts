import { requestData } from './client';
import type {
  AnalyticsOverview,
  ApplicationComparison,
  DistributionBucket,
  SyncHealthItem,
  TrendPoint,
} from '@/types/api';

export type RangeParams = { applicationId?: string; from?: string; to?: string };

export function fetchOverview(params: RangeParams, workspaceId: string) {
  return requestData<AnalyticsOverview>('/analytics/overview', { workspaceId, query: params });
}

export function fetchTrend(params: RangeParams & { granularity?: 'day' | 'week' }, workspaceId: string) {
  return requestData<{ points: TrendPoint[]; range: { from: string; to: string } }>('/analytics/reviews/trend', {
    workspaceId,
    query: params,
  });
}

export function fetchDistribution(params: RangeParams, workspaceId: string) {
  return requestData<{ total: number; averageRating: number | null; buckets: DistributionBucket[] }>(
    '/analytics/reviews/distribution',
    { workspaceId, query: params },
  );
}

export function fetchComparison(params: RangeParams, workspaceId: string) {
  return requestData<{ applications: ApplicationComparison[] }>('/analytics/applications/comparison', {
    workspaceId,
    query: params,
  });
}

export function fetchSyncHealth(params: { applicationId?: string }, workspaceId: string) {
  return requestData<{ items: SyncHealthItem[] }>('/analytics/sync-health', { workspaceId, query: params });
}
