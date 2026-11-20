import type { PageMeta, Paged } from '@/types/admin';

const BASE_URL = '/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, payload: { code?: string; message?: string; details?: unknown }) {
    super(payload.message ?? '请求失败');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code ?? 'UNKNOWN_ERROR';
    this.details = payload.details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
};

function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}${buildQuery(options.query)}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error: { code?: string; message?: string; details?: unknown } }).error
        : {};
    if (response.status === 401) {
      window.dispatchEvent(new Event('reviewmonitor-dash:unauthorized'));
    }
    throw new ApiError(response.status, errorPayload);
  }

  const envelope = payload as { data?: T } | null;
  return (envelope?.data ?? (undefined as unknown as T)) as T;
}

export async function requestList<T>(
  path: string,
  query?: RequestOptions['query'],
): Promise<Paged<T>> {
  const response = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, {
    credentials: 'include',
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const errorPayload = payload?.error ?? {};
    if (response.status === 401) {
      window.dispatchEvent(new Event('reviewmonitor-dash:unauthorized'));
    }
    throw new ApiError(response.status, errorPayload);
  }
  const meta = (payload.meta ?? {}) as PageMeta;
  return {
    items: (payload.data ?? []) as T[],
    meta: { page: meta.page ?? 1, pageSize: meta.pageSize ?? 20, total: meta.total ?? 0, requestId: meta.requestId ?? '' },
  };
}
