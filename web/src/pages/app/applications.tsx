import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Plus, Search } from 'lucide-react';
import { useActiveWorkspace, useCanManage } from '@/store/session';
import { qk } from '@/lib/queryKeys';
import { fetchApplications } from '@/lib/api/applications';
import { PageHeader, LoadingBlock, ErrorBlock } from '@/components/common/page';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StarRating } from '@/components/ui/star-rating';
import { formatRelative } from '@/lib/utils';

export function ApplicationsPage() {
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const canManage = useCanManage();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('active');

  const listQuery = useQuery({
    queryKey: qk.applications(workspaceId ?? '', { keyword, status }),
    queryFn: () => fetchApplications({ keyword: keyword || undefined, status, pageSize: 100 }, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  return (
    <div>
      <PageHeader
        title="应用"
        description="每个应用可绑定多个市场的商店条目，统一采集与处理评价。"
        meta={listQuery.data ? `共 ${listQuery.data.total} 个应用` : undefined}
        actions={
          canManage ? (
            <Button onClick={() => navigate('/app/applications/new')}>
              <Plus className="h-4 w-4" /> 新增应用
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 w-56 pl-8"
            placeholder="搜索应用名称"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <Select className="h-9 w-32" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="active">使用中</option>
          <option value="archived">已归档</option>
        </Select>
      </div>

      {listQuery.isError ? (
        <ErrorBlock message="应用列表加载失败" onRetry={() => listQuery.refetch()} />
      ) : listQuery.isLoading ? (
        <LoadingBlock rows={4} />
      ) : !listQuery.data?.items.length ? (
        <EmptyState
          icon={Boxes}
          title="还没有应用"
          description="先创建应用，再为它绑定 App Store、Google Play 或华为市场条目。"
          action={
            canManage ? (
              <Button size="sm" onClick={() => navigate('/app/applications/new')}>
                <Plus className="h-3.5 w-3.5" /> 新增应用
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listQuery.data.items.map((app) => (
            <Link
              key={app.id}
              to={`/app/applications/${app.id}`}
              className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-subtle"
            >
              <div className="flex items-start gap-3">
                {app.iconUrl ? (
                  <img src={app.iconUrl} alt="" className="h-11 w-11 rounded-lg border object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                    {app.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:text-primary">{app.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {app.bundleId || app.packageName || '未填写包标识'}
                  </p>
                </div>
                {app.status === 'archived' ? <Badge tone="muted">已归档</Badge> : null}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Metric label="评价" value={String(app.reviewCount)} />
                <Metric label="近 7 天" value={String(app.newReviews7d)} />
                <Metric label="绑定市场" value={`${app.enabledStoreAppCount}/${app.storeAppCount}`} />
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {app.averageRating !== null ? (
                    <>
                      <StarRating rating={app.averageRating} size={12} />
                      <span>{app.averageRating.toFixed(1)}</span>
                    </>
                  ) : (
                    '暂无评分'
                  )}
                </span>
                <span>{app.lastSyncedAt ? `同步于 ${formatRelative(app.lastSyncedAt)}` : '尚未同步'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-0 bg-muted/40 py-2 shadow-none">
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </Card>
  );
}
