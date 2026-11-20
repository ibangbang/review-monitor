import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNowStrict, format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined, pattern = 'yyyy-MM-dd HH:mm') {
  if (!value) return '—';
  return format(parseISO(value), pattern);
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return '从未';
  return `${formatDistanceToNowStrict(parseISO(value), { locale: zhCN, addSuffix: true })}`;
}

export function formatFreshness(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${Math.round(minutes)} 分钟前`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} 小时前`;
  return `${Math.round(minutes / (60 * 24))} 天前`;
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function toDateInputValue(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
