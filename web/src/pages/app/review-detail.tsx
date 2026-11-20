import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, History, MessageSquare, Send, Star } from 'lucide-react';
import { useActiveWorkspace } from '@/store/session';
import { qk } from '@/lib/queryKeys';
import { createReviewNote, fetchReview, updateReviewStatus } from '@/lib/api/reviews';
import type { ReviewStatus } from '@/types/api';
import { PageHeader, SectionCard, LoadingBlock, ErrorBlock } from '@/components/common/page';
import { REVIEW_STATUS_LABELS, ReviewStatusBadge, StoreBadge } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/input';
import { StarRating } from '@/components/ui/star-rating';
import { useToast } from '@/components/ui/toast';
import { cn, formatDate, formatRelative } from '@/lib/utils';

const EVENT_LABELS: Record<string, string> = {
  created: '采集入库',
  updated: '商店内容更新',
  status_changed: '状态变更',
  note_added: '添加备注',
};

export function ReviewDetailPage() {
  const { reviewId = '' } = useParams();
  const workspace = useActiveWorkspace();
  const workspaceId = workspace?.publicId ?? null;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [noteDraft, setNoteDraft] = useState('');

  const detailQuery = useQuery({
    queryKey: qk.review(workspaceId ?? '', reviewId),
    queryFn: () => fetchReview(reviewId, workspaceId as string),
    enabled: Boolean(workspaceId && reviewId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: ReviewStatus) => updateReviewStatus(reviewId, status, workspaceId as string),
    onSuccess: () => {
      toast.push('success', '状态已更新');
      queryClient.invalidateQueries({ queryKey: qk.review(workspaceId ?? '', reviewId) });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '更新失败'),
  });

  const noteMutation = useMutation({
    mutationFn: (content: string) => createReviewNote(reviewId, content, workspaceId as string),
    onSuccess: () => {
      setNoteDraft('');
      toast.push('success', '备注已保存');
      queryClient.invalidateQueries({ queryKey: qk.review(workspaceId ?? '', reviewId) });
    },
    onError: (error: unknown) => toast.push('error', error instanceof Error ? error.message : '保存失败'),
  });

  if (detailQuery.isLoading) return <LoadingBlock rows={8} />;
  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorBlock message="评价不存在或无权访问" onRetry={() => detailQuery.refetch()} />;
  }

  const review = detailQuery.data;

  return (
    <div>
      <Link to="/app/reviews" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回评价列表
      </Link>

      <PageHeader
        title={review.title || '（无标题评价）'}
        breadcrumb={[
          { label: '应用', to: '/app/applications' },
          { label: review.application.name, to: `/app/applications/${review.application.id}` },
          { label: review.externalReviewId },
        ]}
        meta={`发表于 ${formatDate(review.sourceCreatedAt)} · 首次采集 ${formatRelative(review.firstSeenAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <Select
              className="h-9 w-32"
              value={review.internalStatus}
              disabled={statusMutation.isPending}
              onChange={(event) => statusMutation.mutate(event.target.value as ReviewStatus)}
            >
              {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((status) => (
                <option key={status} value={status}>
                  {REVIEW_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
            <ReviewStatusBadge status={review.internalStatus} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="评价内容">
            <div className="flex items-center gap-3">
              <StarRating rating={review.rating} size={16} />
              <span className="text-xs text-muted-foreground">{review.rating} 星</span>
              <StoreBadge storeType={review.storeType} />
              {review.countryCode ? <span className="text-xs text-muted-foreground">{review.countryCode}</span> : null}
              {review.appVersion ? <span className="text-xs text-muted-foreground">v{review.appVersion}</span> : null}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{review.content || '（无正文）'}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              {review.authorName ?? '匿名用户'}
              {review.languageCode ? ` · ${review.languageCode}` : ''}
            </p>
            {review.developerReply ? (
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="text-[11px] font-medium text-emerald-800">
                  开发者回复 {review.developerReplyAt ? `· ${formatDate(review.developerReplyAt)}` : ''}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-emerald-900">{review.developerReply}</p>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="内部备注"
            description="仅工作区成员可见，不会同步到商店"
            action={<span className="text-xs text-muted-foreground">{review.notes.length} 条</span>}
          >
            {review.notes.length ? (
              <ul className="space-y-3">
                {review.notes.map((note) => (
                  <li key={note.id} className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="whitespace-pre-wrap text-xs">{note.content}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {note.author.displayName ?? '系统'} · {formatDate(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">还没有备注，记录一下处理结论吧。</p>
            )}

            <div className="mt-4 space-y-2">
              <Textarea
                rows={3}
                placeholder="例如：已确认问题，将在 1.4.0 修复"
                value={noteDraft}
                maxLength={2000}
                onChange={(event) => setNoteDraft(event.target.value)}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{noteDraft.length} / 2000</span>
                <Button
                  size="sm"
                  disabled={!noteDraft.trim() || noteMutation.isPending}
                  onClick={() => noteMutation.mutate(noteDraft.trim())}
                >
                  <Send className="h-3.5 w-3.5" /> 保存备注
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="来源信息">
            <dl className="space-y-2.5 text-xs">
              <Row label="应用">
                <Link to={`/app/applications/${review.application.id}`} className="font-medium text-primary hover:underline">
                  {review.application.name}
                </Link>
              </Row>
              <Row label="商店标识">{review.storeApp.externalAppId}</Row>
              <Row label="外部评价 ID">
                <span className="break-all font-mono text-[11px]">{review.externalReviewId}</span>
              </Row>
              <Row label="设备">{review.device ?? '—'}</Row>
              <Row label="系统版本">{review.osVersion ?? '—'}</Row>
              <Row label="最近同步">{formatDate(review.lastSyncedAt)}</Row>
              {review.storeApp.storeUrl ? (
                <Row label="商店链接">
                  <a
                    href={review.storeApp.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    打开
                  </a>
                </Row>
              ) : null}
            </dl>
          </SectionCard>

          <SectionCard title="处理轨迹" action={<History className="h-3.5 w-3.5 text-muted-foreground" />}>
            {review.events.length ? (
              <ol className="relative space-y-3 border-l pl-4">
                {review.events.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    <p className="text-xs font-medium">{EVENT_LABELS[event.eventType] ?? event.eventType}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(event.createdAt)} · {event.source}
                    </p>
                    {event.eventType === 'status_changed' && event.newValues ? (
                      <p className={cn('mt-0.5 text-[11px] text-muted-foreground')}>
                        {String((event.oldValues as Record<string, unknown> | null)?.status ?? '—')} →{' '}
                        {String((event.newValues as Record<string, unknown>).status ?? '—')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" /> 暂无事件记录
              </p>
            )}
          </SectionCard>

          <SectionCard title="评分提示">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 text-star" /> 低星（1–2 星）评价会触发已配置的通知规则。
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right">{children}</dd>
    </div>
  );
}
