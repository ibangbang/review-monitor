import { Badge } from '@/components/ui/badge';
import type { ReviewStatus, StoreType } from '@/types/api';
import { STORE_LABELS } from '@/lib/api/stores';

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  unprocessed: '待处理',
  processing: '处理中',
  resolved: '已解决',
  ignored: '已忽略',
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const tone = status === 'resolved' ? 'success' : status === 'ignored' ? 'muted' : status === 'processing' ? 'primary' : 'warning';
  return <Badge tone={tone}>{REVIEW_STATUS_LABELS[status]}</Badge>;
}

export function StoreBadge({ storeType }: { storeType: StoreType }) {
  return <Badge tone="neutral">{STORE_LABELS[storeType] ?? storeType}</Badge>;
}

export type SyncState = 'healthy' | 'delayed' | 'stale' | 'failing' | 'paused' | 'never';

export const SYNC_STATE_LABELS: Record<SyncState, string> = {
  healthy: '正常',
  delayed: '延迟',
  stale: '过期',
  failing: '异常',
  paused: '已暂停',
  never: '未同步',
};

export function SyncStateBadge({ state }: { state: SyncState }) {
  const tone =
    state === 'healthy' ? 'success' : state === 'failing' || state === 'stale' ? 'danger' : state === 'paused' ? 'muted' : 'warning';
  return <Badge tone={tone}>{SYNC_STATE_LABELS[state]}</Badge>;
}

export function ConnectionStatusBadge({ status }: { status: string }) {
  const tone = status === 'active' ? 'success' : status === 'invalid' ? 'danger' : 'muted';
  const label = status === 'active' ? '授权有效' : status === 'invalid' ? '授权失效' : '已停用';
  return <Badge tone={tone}>{label}</Badge>;
}
