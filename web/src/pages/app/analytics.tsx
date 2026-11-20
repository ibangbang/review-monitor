import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BarChart3, PieChart } from 'lucide-react';
import { useActiveWorkspace } from '@/store/session';
import { qk } from '@/lib/queryKeys';
import { fetchApplications } from '@/lib/api/applications';
import { fetchComparison, fetchDistribution, fetchOverview, fetchSyncHealth, fetchTrend } from '@/lib/api/analytics';
import { PageHeader, SectionCard, LoadingBlock, ErrorBlock } from '@/components/common/page';
import { StoreBadge, SyncStateBadge } from '@/components/common/status';
import { Select } from '@/components/ui/input';
import { StarRating } from '@/components/ui/star-rating';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatRelative } from '@/lib/utils';

const RANGE_OPTIONS = [
  { value: '7', label: '最近 7 天' },
  { value: '30', label: '最近 30 天' },
  { value: '90', label: '最近 90 天' },
];

export function AnalyticsPage() {
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const [days, setDays] = useState('30');
  const [applicationId, setApplicationId] = useState('');
  const [granularity, setGranularity] = useState<'day' | 'week'>('day');

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - Number(days));
    return { from: from.toISOString(), to: to.toISOString(), applicationId: applicationId || undefined };
  }, [days, applicationId]);

  const appsQuery = useQuery({
    queryKey: qk.applications(workspaceId ?? '', { pageSize: 100 }),
    queryFn: () => fetchApplications({ pageSize: 100 }, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const overviewQuery = useQuery({
    queryKey: qk.analytics(workspaceId ?? '', 'overview', range),
    queryFn: () => fetchOverview(range, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const trendQuery = useQuery({
    queryKey: qk.analytics(workspaceId ?? '', 'trend', { ...range, granularity }),
    queryFn: () => fetchTrend({ ...range, granularity }, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const distributionQuery = useQuery({
    queryKey: qk.analytics(workspaceId ?? '', 'distribution', range),
    queryFn: () => fetchDistribution(range, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const comparisonQuery = useQuery({
    queryKey: qk.analytics(workspaceId ?? '', 'comparison', range),
    queryFn: () => fetchComparison(range, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const healthQuery = useQuery({
    queryKey: qk.syncHealth(workspaceId ?? ''),
    queryFn: () => fetchSyncHealth({}, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const trend = trendQuery.data?.points ?? [];
  const distribution = distributionQuery.data?.buckets ?? [];
  const totals = overviewQuery.data?.totals;

  return (
    <div>
      <PageHeader
        title="分析"
        description="基于已采集评价样本的趋势、分布与市场对比。"
        meta="样本口径：仅统计本系统已采集的评价，与商店展示的总体评分可能存在差异"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select className="h-9 w-40" value={applicationId} onChange={(event) => setApplicationId(event.target.value)}>
              <option value="">全部应用</option>
              {appsQuery.data?.items.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </Select>
            <Select className="h-9 w-32" value={days} onChange={(event) => setDays(event.target.value)}>
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {overviewQuery.isError ? <ErrorBlock message="分析数据加载失败" onRetry={() => overviewQuery.refetch()} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="评价总量" value={String(totals?.reviewCount ?? '—')} sub={totals?.changePercent !== null && totals ? `${totals.changePercent > 0 ? '+' : ''}${totals.changePercent.toFixed(1)}% 环比` : '无环比数据'} />
        <Kpi label="平均评分" value={totals?.averageRating != null ? totals.averageRating.toFixed(2) : '—'} sub="加权平均" />
        <Kpi label="低星占比" value={totals ? `${totals.lowRatingRatio.toFixed(1)}%` : '—'} sub={totals ? `${totals.lowRatingCount} 条 1–2 星` : ''} />
        <Kpi label="待处理" value={String(totals?.pendingCount ?? '—')} sub="待处理 + 处理中" />
      </div>

      <SectionCard
        className="mt-6"
        title="评价趋势"
        description="按时间分桶统计评价量与平均评分"
        action={
          <div className="flex items-center gap-1 rounded-md border p-0.5 text-[11px]">
            {(['day', 'week'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setGranularity(value)}
                className={`rounded px-2 py-1 ${granularity === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {value === 'day' ? '按天' : '按周'}
              </button>
            ))}
          </div>
        }
      >
        {trendQuery.isLoading ? (
          <LoadingBlock rows={6} />
        ) : trend.length ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: string) => (value.length > 7 ? value.slice(5) : value)}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'hsl(var(--border))' }}
                  labelFormatter={(value: string) => `时间：${value}`}
                />
                <Bar yAxisId="left" dataKey="reviewCount" name="评价数" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} barSize={18} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="averageRating"
                  name="平均评分"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={BarChart3} title="该时间范围内没有评价" description="调整时间范围或应用筛选试试。" />
        )}
      </SectionCard>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SectionCard title="评分分布" description={`样本 ${distributionQuery.data?.total ?? 0} 条`}>
          {distributionQuery.isLoading ? (
            <LoadingBlock rows={5} />
          ) : distribution.some((bucket) => bucket.reviewCount > 0) ? (
            <div className="space-y-2.5">
              {distribution.map((bucket) => (
                <div key={bucket.rating} className="flex items-center gap-3">
                  <div className="flex w-14 items-center gap-1">
                    <StarRating rating={bucket.rating} size={11} />
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(bucket.ratio, bucket.reviewCount ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-[11px] text-muted-foreground">
                    {bucket.reviewCount} · {bucket.ratio.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={PieChart} title="暂无分布数据" />
          )}
        </SectionCard>

        <SectionCard title="采集健康" description="按同步新鲜度判定">
          {healthQuery.isLoading ? (
            <LoadingBlock rows={5} />
          ) : healthQuery.data?.items.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>应用</TH>
                  <TH>状态</TH>
                  <TH>上次同步</TH>
                </TR>
              </THead>
              <TBody>
                {healthQuery.data.items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <p className="text-xs font-medium">{item.application.name}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <StoreBadge storeType={item.storeType} />
                        <span className="truncate text-[11px] text-muted-foreground">{item.externalAppId}</span>
                      </div>
                    </TD>
                    <TD>
                      <SyncStateBadge state={item.state} />
                    </TD>
                    <TD className="text-[11px] text-muted-foreground">
                      {item.lastSyncedAt ? formatRelative(item.lastSyncedAt) : '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState icon={Activity} title="还没有市场绑定" />
          )}
        </SectionCard>
      </div>

      <SectionCard className="mt-5" title="应用对比" description="同周期内各应用的评价表现">
        {comparisonQuery.isLoading ? (
          <LoadingBlock rows={4} />
        ) : comparisonQuery.data?.applications.length ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={comparisonQuery.data.applications} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'hsl(var(--border))' }} />
                <Bar yAxisId="left" dataKey="reviewCount" name="评价数" radius={[3, 3, 0, 0]} barSize={26}>
                  {comparisonQuery.data.applications.map((item) => (
                    <Cell key={item.id} fill="hsl(var(--primary))" />
                  ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="averageRating" name="平均评分" stroke="#f59e0b" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={BarChart3} title="暂无可对比的应用数据" />
        )}
      </SectionCard>

      <p className="mt-4 text-[11px] text-muted-foreground">
        统计时间 {overviewQuery.data ? formatDate(overviewQuery.data.asOf) : '—'} · 时间范围{' '}
        {overviewQuery.data ? `${formatDate(overviewQuery.data.range.from)} ~ ${formatDate(overviewQuery.data.range.to)}` : '—'}
      </p>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
