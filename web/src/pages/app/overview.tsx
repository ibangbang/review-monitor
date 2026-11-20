import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  MessageSquare,
  Sparkles,
  Star,
  TriangleAlert,
  Clock3,
} from 'lucide-react';
import { useActiveWorkspace } from '@/store/session';
import { qk } from '@/lib/queryKeys';
import { fetchOverview } from '@/lib/api/analytics';
import { fetchReviews } from '@/lib/api/reviews';
import { fetchSyncHealth } from '@/lib/api/analytics';
import { fetchNotificationHistory } from '@/lib/api/notifications';
import { PageHeader, SectionCard, LoadingBlock, ErrorBlock, InfoRow } from '@/components/common/page';
import { ReviewStatusBadge, StoreBadge, SyncStateBadge, SYNC_STATE_LABELS } from '@/components/common/status';
import { Card } from '@/components/ui/card';
import { StarRating } from '@/components/ui/star-rating';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { cn, formatRelative, formatDate } from '@/lib/utils';
import type { SyncState } from '@/components/common/status';

function StatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  icon: typeof MessageSquare;
  tone?: 'danger' | 'warning';
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('text-2xl font-semibold tracking-tight', tone === 'danger' && 'text-red-600')}>{value}</p>
        </div>
        <span className="rounded-md bg-muted p-1.5 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        {delta !== undefined && delta !== null ? (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', positive ? 'text-emerald-600' : 'text-red-600')}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </Card>
  );
}

export function OverviewPage() {
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const [range] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  });

  const overviewQuery = useQuery({
    queryKey: qk.analytics(workspaceId ?? '', 'overview', range),
    queryFn: () => fetchOverview(range, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const reviewsQuery = useQuery({
    queryKey: qk.reviews(workspaceId ?? '', { pageSize: 5, sort: 'newest' }),
    queryFn: () => fetchReviews({ pageSize: 5, sort: 'newest' }, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const healthQuery = useQuery({
    queryKey: qk.syncHealth(workspaceId ?? ''),
    queryFn: () => fetchSyncHealth({}, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const historyQuery = useQuery({
    queryKey: qk.history(workspaceId ?? '', { pageSize: 4 }),
    queryFn: () => fetchNotificationHistory({ pageSize: 4 }, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const totals = overviewQuery.data?.totals;
  const attention = useMemo(() => {
    const items = healthQuery.data?.items ?? [];
    return items.filter((item) => ['failing', 'stale', 'never'].includes(item.state));
  }, [healthQuery.data]);

  return (
    <div>
      <PageHeader
        title="概览"
        description={`${workspace?.name ?? ''} · 最近 30 天采集样本`}
        meta={
          totals?.lastSyncedAt
            ? `数据更新时间 ${formatDate(totals.lastSyncedAt)} · 样本统计与商店官方总体评分不同`
            : '尚无采集数据，请先连接市场并绑定应用'
        }
        actions={
          <Badge tone="muted" className="gap-1">
            <Sparkles className="h-3 w-3" /> 采集样本口径
          </Badge>
        }
      />

      {overviewQuery.isError ? (
        <ErrorBlock message="概览数据加载失败" onRetry={() => overviewQuery.refetch()} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="新增评价"
          value={overviewQuery.isLoading ? '—' : String(totals?.reviewCount ?? 0)}
          delta={totals?.changePercent}
          hint="较上一个周期"
          icon={MessageSquare}
        />
        <StatCard
          label="低星评价（1–2 星）"
          value={overviewQuery.isLoading ? '—' : String(totals?.lowRatingCount ?? 0)}
          hint={totals ? `占比 ${totals.lowRatingRatio.toFixed(1)}%` : undefined}
          tone="danger"
          icon={TriangleAlert}
        />
        <StatCard
          label="平均评分"
          value={overviewQuery.isLoading ? '—' : totals?.averageRating !== null ? String(totals?.averageRating ?? '—') : '—'}
          hint="基于采集样本"
          icon={Star}
        />
        <StatCard
          label="待处理"
          value={overviewQuery.isLoading ? '—' : String(totals?.pendingCount ?? 0)}
          hint="待处理 + 处理中（全部时间）"
          icon={Clock3}
        />
      </div>

      {attention.length ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-600" />
            <div className="min-w-0 flex-1 text-xs text-amber-900">
              <p className="font-medium">有 {attention.length} 个市场绑定需要关注</p>
              <ul className="mt-1 space-y-1">
                {attention.slice(0, 3).map((item) => (
                  <li key={item.storeAppId} className="flex items-center gap-2">
                    <span className="truncate">
                      {item.applicationName} · {item.externalAppId}
                    </span>
                    <Badge tone="warning">{SYNC_STATE_LABELS[item.state as SyncState]}</Badge>
                    <span className="truncate text-amber-700">{item.lastErrorMessage ?? '尚未完成首次同步'}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link to="/app/applications" className="shrink-0 text-xs font-medium underline underline-offset-2">
              去处理
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="最近评价"
          action={
            <Link to="/app/reviews" className="text-xs font-medium text-primary hover:underline">
              查看全部
            </Link>
          }
          bodyClassName="px-0 py-0"
        >
          {reviewsQuery.isLoading ? (
            <div className="p-5">
              <LoadingBlock rows={4} />
            </div>
          ) : reviewsQuery.data?.items.length ? (
            <ul className="divide-y">
              {reviewsQuery.data.items.map((review) => (
                <li key={review.id}>
                  <Link
                    to={`/app/reviews/${review.id}`}
                    className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex w-16 shrink-0 flex-col items-start gap-1">
                      <StarRating rating={review.rating} />
                      <span className="text-[11px] text-muted-foreground">{formatRelative(review.sourceCreatedAt)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{review.title || '（无标题）'}</p>
                        <ReviewStatusBadge status={review.internalStatus} />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{review.contentExcerpt}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{review.application.name}</span>
                        <StoreBadge storeType={review.storeType} />
                        {review.appVersion ? <span>v{review.appVersion}</span> : null}
                        {review.countryCode ? <span>{review.countryCode}</span> : null}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="还没有采集到评价"
              description="接入应用商店后，这里会显示最新评价。"
              action={
                <Link to="/app/applications/new" className="text-xs font-medium text-primary hover:underline">
                  添加应用
                </Link>
              }
            />
          )}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="采集状态" description="按同步新鲜度判断" bodyClassName="px-5 py-3">
            {healthQuery.isLoading ? (
              <LoadingBlock rows={3} />
            ) : healthQuery.data?.items.length ? (
              <ul className="space-y-2.5">
                {healthQuery.data.items.slice(0, 5).map((item) => (
                  <li key={item.storeAppId} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.applicationName}</p>
                      <p className="truncate text-muted-foreground">
                        {item.externalAppId} ·{' '}
                        {item.state === 'never'
                          ? '尚未同步'
                          : item.freshnessMinutes !== null
                            ? `${Math.round(item.freshnessMinutes)} 分钟前`
                            : '—'}
                      </p>
                    </div>
                    <SyncStateBadge state={item.state} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">暂无绑定</p>
            )}
          </SectionCard>

          <SectionCard
            title="最近通知"
            action={
              <Link to="/app/notifications" className="text-xs font-medium text-primary hover:underline">
                通知设置
              </Link>
            }
            bodyClassName="px-5 py-3"
          >
            {historyQuery.isLoading ? (
              <LoadingBlock rows={3} />
            ) : historyQuery.data?.items.length ? (
              <ul className="space-y-2.5">
                {historyQuery.data.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-xs">
                    <BellRing className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{String(item.payload.title ?? item.eventType)}</p>
                      <p className="truncate text-muted-foreground">
                        {item.channel?.name ?? '未知渠道'} · {formatRelative(item.createdAt)}
                      </p>
                    </div>
                    <Badge
                      tone={item.status === 'sent' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}
                    >
                      {item.status === 'sent' ? '已发送' : item.status === 'failed' ? '失败' : '排队中'}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">还没有通知记录</p>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <SectionCard title="应用与监控" bodyClassName="px-5 py-3">
          <InfoRow label="应用数">{totals?.applicationCount ?? '—'}</InfoRow>
          <InfoRow label="已绑定市场">{totals?.storeAppCount ?? '—'}</InfoRow>
          <InfoRow label="最近同步">{totals?.lastSyncedAt ? formatRelative(totals.lastSyncedAt) : '尚未同步'}</InfoRow>
        </SectionCard>
        <SectionCard title="快速开始" bodyClassName="px-5 py-3">
          <ul className="space-y-2 text-xs">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> 连接商店凭据（App Store Connect / Google Play / 华为）
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" /> 绑定应用到市场
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/40" /> 配置低星即时通知
            </li>
          </ul>
          <div className="mt-3 flex gap-3 text-xs">
            <Link to="/app/stores" className="font-medium text-primary hover:underline">
              连接市场
            </Link>
            <Link to="/app/applications/new" className="font-medium text-primary hover:underline">
              添加应用
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
