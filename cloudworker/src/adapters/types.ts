export type StoreType = 'apple' | 'google' | 'huawei' | 'xiaomi' | 'oppo' | 'vivo' | 'mock';

export type DecryptedCredential = Record<string, unknown>;

export type StoreAppContext = {
  storeAppId: string;
  applicationId: string;
  workspaceId: string;
  storeType: StoreType;
  externalAppId: string;
  countryCode: string;
  displayName: string | null;
};

export type NormalizedReview = {
  externalReviewId: string;
  rating: number;
  title: string | null;
  content: string | null;
  authorName: string | null;
  countryCode: string | null;
  languageCode: string | null;
  appVersion: string | null;
  device: string | null;
  osVersion: string | null;
  sourceCreatedAt: Date;
  sourceUpdatedAt: Date | null;
  developerReply: string | null;
  developerReplyAt: Date | null;
  raw?: Record<string, unknown> | null;
};

export type FetchReviewsInput = {
  storeApp: StoreAppContext;
  credential: DecryptedCredential;
  cursor?: string | null;
  since?: Date | null;
  pageToken?: string | null;
  pageSize: number;
};

export type FetchReviewsResult = {
  reviews: NormalizedReview[];
  nextCursor?: string | null;
  pageToken?: string | null;
  hasMore: boolean;
  sourceSyncedAt: Date;
};

export type ValidationResult = {
  valid: boolean;
  code?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export interface StoreReviewAdapter {
  readonly storeType: StoreType;
  readonly version: string;
  validateCredentialShape(credentials: DecryptedCredential): string[];
  validateConnection(credentials: DecryptedCredential): Promise<ValidationResult>;
  fetchReviews(input: FetchReviewsInput): Promise<FetchReviewsResult>;
}

export const STORE_LABELS: Record<StoreType, string> = {
  apple: 'App Store',
  google: 'Google Play',
  huawei: '华为应用市场',
  xiaomi: '小米应用商店',
  oppo: 'OPPO 软件商店',
  vivo: 'vivo 应用商店',
  mock: '演示商店',
};

export function requireString(credentials: DecryptedCredential, key: string): string {
  const value = credentials[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`凭证缺少字段 ${key}`);
  }
  return value.trim();
}

export function optionalString(credentials: DecryptedCredential, key: string): string | null {
  const value = credentials[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
