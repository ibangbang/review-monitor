export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

const BASE_URL = '/api/v1';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  workspaceId?: string | null;
  query?: Record<string, string | number | boolean | null | undefined>;
};

export type RawResponse<T> = {
  data: T;
  meta: { requestId?: string; page?: number; pageSize?: number; total?: number };
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<RawResponse<T>> {
  const { method = 'GET', body, workspaceId, query } = options;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const queryString = search.toString();
  const url = `${BASE_URL}${path}${queryString ? `?${queryString}` : ''}`;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: '网络异常，请检查 API 服务是否运行' });
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('reviewmonitor:unauthorized'));
  }

  if (response.status === 204) {
    return { data: undefined as T, meta: {} };
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const error = (payload.error ?? {}) as ApiErrorPayload;
    throw new ApiError(response.status, {
      code: error.code ?? 'REQUEST_FAILED',
      message: error.message ?? `请求失败（${response.status}）`,
      details: error.details,
    });
  }

  if (!('data' in payload)) {
    return { data: payload as T, meta: {} };
  }
  return payload as unknown as RawResponse<T>;
}

export async function requestData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await request<T>(path, options);
  return data;
}

export type ListResult<T> = { items: T[]; total: number; page: number; pageSize: number };

export async function requestList<T>(
  path: string,
  options: RequestOptions & { page?: number; pageSize?: number } = {},
): Promise<ListResult<T>> {
  const { page, pageSize, query, ...rest } = options;
  const response = await request<T[]>(path, {
    ...rest,
    query: { ...query, page, pageSize },
  });
  const data = Array.isArray(response.data) ? response.data : [];
  return {
    items: data,
    total: response.meta.total ?? data.length,
    page: response.meta.page ?? page ?? 1,
    pageSize: response.meta.pageSize ?? pageSize ?? 20,
  };
}
