import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Search, SlidersHorizontal } from 'lucide-react';
import { useActiveWorkspace } from '@/store/session';
import { qk } from '@/lib/queryKeys';
import { fetchReviews, updateReviewStatus } from '@/lib/api/reviews';
import { fetchApplications } from '@/lib/api/applications';
import type { Review, ReviewStatus } from '@/types/api';
import { PageHeader, LoadingBlock, ErrorBlock } from '@/components/common/page';
import { REVIEW_STATUS_LABELS, StoreBadge } from '@/components/common/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { StarRating } from '@/components/ui/star-rating';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatDate, formatRelative } from '@/lib/utils';

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'newest', label: '最新评价' },
  { value: 'oldest', label: '最早评价' },
  { value: 'rating_desc', label: '评分从高到低' },
  { value: 'rating_asc', label: '评分从低到高' },
  { value: 'updated', label: '最近更新' },
];

export function ReviewsPage() {
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const filters = useMemo(
    () => ({
      keyword: params.get('keyword') ?? undefined,
      status: (params.get('status') as ReviewStatus | null) ?? undefined,
      rating: params.get('rating') ? Number(params.get('rating')) : undefined,
      storeType: params.get('storeType') ?? undefined,
      applicationId: params.get('applicationId') ?? undefined,
      sort: (params.get('sort') as 'newest' | 'oldest' | 'rating_desc' | 'rating_asc' | 'updated' | null) ?? 'newest',
      page: Number(params.get('page') ?? 1) || 1,
      pageSize: PAGE_SIZE,
    }),
    [params],
  );

  const listQuery = useQuery({
    queryKey: qk.reviews(workspaceId ?? '', filters),
    queryFn: () => fetchReviews(filters, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const appsQuery = useQuery({
    queryKey: qk.applications(workspaceId ?? '', { pageSize: 100 }),
    queryFn: () => fetchApplications({ pageSize: 100 }, workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
      updateReviewStatus(id, status, workspaceId as string),
    onSuccess: () => {
      toast.push('success', '状态已更新');
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error: unknown) => {
      toast.push('error', error instanceof Error ? error.message : '更新失败');
    },
  });

  function patchFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  }

  const total = listQuery.data?.total ?? 0;
  const page = filters.page;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="评价"
        description="跨市场统一评价流，按市场、评分、状态与关键词筛选。"
        meta={listQuery.data ? `共 ${total} 条评价` : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 w-56 pl-8"
            placeholder="搜索标题 / 内容 / 作者"
            defaultValue={filters.keyword ?? ''}
            onKeyDown={(event) => {
              if (event.key === 'Enter') patchFilter('keyword', (event.target as HTMLInputElement).value.trim());
            }}
          />
        </div>

        <Select
          className="h-9 w-36"
          value={filters.applicationId ?? ''}
          onChange={(event) => patchFilter('applicationId', event.target.value)}
        >
          <option value="">全部应用</option>
          {appsQuery.data?.items.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </Select>

        <Select className="h-9 w-32" value={filters.storeType ?? ''} onChange={(event) => patchFilter('storeType', event.target.value)}>
          <option value="">全部市场</option>
          <option value="apple">App Store</option>
          <option value="google">Google Play</option>
          <option value="huawei">华为应用市场</option>
          <option value="mock">演示商店</option>
        </Select>

        <Select className="h-9 w-32" value={filters.rating ? String(filters.rating) : ''} onChange={(event) => patchFilter('rating', event.target.value)}>
          <option value="">全部评分</option>
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {rating} 星
            </option>
          ))}
        </Select>

        <Select className="h-9 w-32" value={filters.status ?? ''} onChange={(event) => patchFilter('status', event.target.value)}>
          <option value="">全部状态</option>
          <option value="unprocessed">待处理</option>
          <option value="processing">处理中</option>
          <option value="resolved">已解决</option>
          <option value="ignored">已忽略</option>
        </Select>

        <Select className="h-9 w-36" value={filters.sort} onChange={(event) => patchFilter('sort', event.target.value)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {params.toString() ? (
          <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> 重置
          </Button>
        ) : null}
      </div>

      {listQuery.isError ? (
        <ErrorBlock message="评价加载失败" onRetry={() => listQuery.refetch()} />
      ) : listQuery.isLoading ? (
        <LoadingBlock rows={8} />
      ) : !listQuery.data?.items.length ? (
        <EmptyState
          icon={MessageSquare}
          title="没有符合条件的评价"
          description="试试放宽筛选条件，或确认市场绑定是否已开始采集。"
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-28">评分</TH>
                    <TH>评价</TH>
                    <TH className="w-40">应用 / 市场</TH>
                    <TH className="w-24">国家 / 版本</TH>
                    <TH className="w-28">时间</TH>
                    <TH className="w-32">状态</TH>
                  </TR>
                </THead>
                <TBody>
                  {listQuery.data.items.map((review: Review) => (
                    <TR key={review.id} className="align-top">
                      <TD>
                        <StarRating rating={review.rating} />
                        <p className="mt-1 text-[11px] text-muted-foreground">{review.rating} 星</p>
                      </TD>
                      <TD className="max-w-[420px]">
                        <Link to={`/app/reviews/${review.id}`} className="group block">
                          <p className="truncate text-sm font-medium group-hover:text-primary">
                            {review.title || '（无标题）'}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{review.contentExcerpt}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{review.authorName ?? '匿名用户'}</p>
                        </Link>
                      </TD>
                      <TD>
                        <p className="truncate text-xs font-medium">{review.application.name}</p>
                        <div className="mt-1">
                          <StoreBadge storeType={review.storeType} />
                        </div>
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        <p>{review.countryCode ?? '—'}</p>
                        <p className="mt-0.5">{review.appVersion ? `v${review.appVersion}` : '—'}</p>
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        <p title={formatDate(review.sourceCreatedAt)}>{formatRelative(review.sourceCreatedAt)}</p>
                      </TD>
                      <TD>
                        <Select
                          className="h-8 w-full text-xs"
                          value={review.internalStatus}
                          disabled={statusMutation.isPending}
                          onChange={(event) =>
                            statusMutation.mutate({ id: review.id, status: event.target.value as ReviewStatus })
                          }
                        >
                          {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {REVIEW_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </Select>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              第 {page} / {pageCount} 页 · 共 {total} 条
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => patchFilter('page', String(page - 1))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => patchFilter('page', String(page + 1))}
              >
                下一页
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="muted" className={cn('gap-1')}>
          评价内容来自商店官方接口，状态与备注仅在本系统内可见
        </Badge>
      </div>
    </div>
  );
}
