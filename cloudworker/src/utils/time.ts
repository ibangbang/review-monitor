export function nowMs(): number {
  return Date.now();
}

export function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

/**
 * 指数退避 + 抖动。attempt 从 1 开始。
 * base * 2^(attempt-1)，上限 max，抖动 ±20%。
 */
export function backoffSeconds(
  attempt: number,
  baseSeconds: number,
  maxSeconds: number,
  random: () => number = Math.random,
): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const exponential = baseSeconds * Math.pow(2, safeAttempt - 1);
  const capped = Math.min(exponential, maxSeconds);
  const jitter = 0.8 + random() * 0.4;
  return Math.max(1, Math.round(capped * jitter));
}

export function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toIso(value: unknown): string | null {
  const date = toDateOrNull(value);
  return date ? date.toISOString() : null;
}

export function formatDateTime(date: Date): string {
  // mysql2 会按连接 timezone 转换 Date，这里仅用于日志
  return date.toISOString();
}
