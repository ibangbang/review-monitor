import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  return dayjs(value).format('YYYY-MM-DD');
}

export function fromNow(value?: string | null): string {
  if (!value) return '—';
  return dayjs(value).fromNow();
}

export function formatDuration(startAt?: string | null, endAt?: string | null): string {
  if (!startAt || !endAt) return '—';
  const ms = dayjs(endAt).valueOf() - dayjs(startAt).valueOf();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分`;
}

export const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待执行', color: 'orange' },
  running: { label: '执行中', color: 'arcoblue' },
  succeeded: { label: '成功', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'gray' },
};

export const OUTBOX_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '排队中', color: 'orange' },
  running: { label: '发送中', color: 'arcoblue' },
  sent: { label: '已发送', color: 'green' },
  failed: { label: '失败', color: 'red' },
  cancelled: { label: '已取消', color: 'gray' },
};

export const REVIEW_STATUS_META: Record<string, { label: string; color: string }> = {
  unprocessed: { label: '待处理', color: 'orange' },
  processing: { label: '处理中', color: 'arcoblue' },
  resolved: { label: '已处理', color: 'green' },
  ignored: { label: '已忽略', color: 'gray' },
};

export const CONNECTION_STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'green' },
  invalid: { label: '已失效', color: 'red' },
  disabled: { label: '已停用', color: 'gray' },
};

export const ROLE_LABELS: Record<string, string> = { owner: '拥有者', admin: '管理员', member: '成员' };

export const EVENT_TYPE_LABELS: Record<string, string> = {
  'review.created': '新评价',
  'review.updated': '评价更新',
  'sync.failed': '同步失败',
  'auth.invalid': '授权失效',
};

export const STORE_LABELS: Record<string, string> = {
  apple: 'App Store',
  google: 'Google Play',
  huawei: 'AppGallery',
  xiaomi: 'Xiaomi GetApps',
  oppo: 'OPPO App Market',
  vivo: 'vivo App Store',
  mock: '演示商店',
};

export function ratingStars(rating: number): string {
  const filled = '★'.repeat(Math.max(0, Math.min(5, rating)));
  const empty = '☆'.repeat(Math.max(0, 5 - rating));
  return `${filled}${empty}`;
}
