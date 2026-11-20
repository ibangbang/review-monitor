import {
  DecryptedCredential,
  FetchReviewsInput,
  FetchReviewsResult,
  NormalizedReview,
  StoreReviewAdapter,
  StoreType,
  ValidationResult,
  fetchWithTimeout,
  optionalString,
  requireString,
} from './types';
import { WorkerError, classifyHttpStatus } from '../utils/errors';

const DEFAULT_BASE = 'https://connect-api.cloud.huawei.com';
const DEFAULT_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

type HuaweiReview = {
  reviewId?: string;
  id?: string;
  rating?: number;
  content?: string;
  title?: string;
  userName?: string;
  userNickName?: string;
  countryCode?: string;
  language?: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  createTime?: number | string;
  updateTime?: number | string;
  developerReply?: string;
  developerReplyTime?: number | string;
};

type HuaweiResponse = {
  reviews?: HuaweiReview[];
  hasMore?: boolean;
  total?: number;
  itemList?: HuaweiReview[];
};

export class HuaweiStoreAdapter implements StoreReviewAdapter {
  readonly storeType: StoreType = 'huawei';
  readonly version = '1.0.0';

  private baseUrl(credential: DecryptedCredential): string {
    return optionalString(credential, 'apiBase') ?? DEFAULT_BASE;
  }

  private tokenUrl(credential: DecryptedCredential): string {
    return optionalString(credential, 'tokenUrl') ?? DEFAULT_TOKEN_URL;
  }

  private async accessToken(credential: DecryptedCredential): Promise<string> {
    const clientId = requireString(credential, 'clientId');
    const clientSecret = requireString(credential, 'clientSecret');
    const response = await fetchWithTimeout(
      this.tokenUrl(credential),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      },
      10000,
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new WorkerError(
        'STORE_AUTH_FAILED',
        `华为认证失败 ${response.status}: ${text.slice(0, 200)}`,
        'permanent',
      );
    }
    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) {
      throw WorkerError.permanent('STORE_AUTH_FAILED', '华为认证未返回 access_token');
    }
    return payload.access_token;
  }

  validateCredentialShape(credentials: DecryptedCredential): string[] {
    const errors: string[] = [];
    for (const key of ['clientId', 'clientSecret']) {
      const value = credentials[key];
      if (typeof value !== 'string' || value.trim() === '') errors.push(`缺少字段 ${key}`);
    }
    return errors;
  }

  async validateConnection(credentials: DecryptedCredential): Promise<ValidationResult> {
    try {
      await this.accessToken(credentials);
      return { valid: true };
    } catch (error) {
      return { valid: false, code: 'STORE_AUTH_FAILED', message: (error as Error).message };
    }
  }

  async fetchReviews(input: FetchReviewsInput): Promise<FetchReviewsResult> {
    const { storeApp, credential, pageSize } = input;
    const clientId = requireString(credential, 'clientId');
    const token = await this.accessToken(credential);
    const offset = input.pageToken ? Number.parseInt(input.pageToken, 10) : 0;
    const params = new URLSearchParams({
      appId: storeApp.externalAppId,
      countryCode: storeApp.countryCode,
      limit: String(Math.min(Math.max(pageSize, 1), 100)),
      offset: String(Number.isFinite(offset) ? offset : 0),
    });

    const response = await fetchWithTimeout(`${this.baseUrl(credential)}/api/app/v1/reviews?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, client_id: clientId, Accept: 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new WorkerError(
        response.status === 404 ? 'HUAWEI_REVIEWS_UNAVAILABLE' : 'STORE_API_ERROR',
        `华为应用市场返回 ${response.status}: ${text.slice(0, 200)}`,
        response.status === 404 ? 'permanent' : classifyHttpStatus(response.status),
      );
    }

    const payload = (await response.json()) as HuaweiResponse;
    const items = payload.reviews ?? payload.itemList ?? [];
    const reviews: NormalizedReview[] = items.map((item, index) => {
      const created = item.createTime
        ? new Date(typeof item.createTime === 'number' ? item.createTime : Date.parse(String(item.createTime)))
        : new Date();
      return {
        externalReviewId: item.reviewId ?? item.id ?? `${storeApp.externalAppId}-${offset + index}`,
        rating: Number(item.rating ?? 0),
        title: item.title ?? null,
        content: item.content ?? null,
        authorName: item.userNickName ?? item.userName ?? null,
        countryCode: item.countryCode ?? storeApp.countryCode ?? null,
        languageCode: item.language ?? null,
        appVersion: item.appVersion ?? null,
        device: item.deviceModel ?? null,
        osVersion: item.osVersion ?? null,
        sourceCreatedAt: created,
        sourceUpdatedAt: item.updateTime ? new Date(item.updateTime as number) : null,
        developerReply: item.developerReply ?? null,
        developerReplyAt: item.developerReplyTime ? new Date(item.developerReplyTime as number) : null,
        raw: item as Record<string, unknown>,
      } satisfies NormalizedReview;
    });

    const nextOffset = offset + items.length;
    const hasMore = payload.hasMore ?? (payload.total != null ? nextOffset < payload.total : items.length >= pageSize);
    return {
      reviews,
      pageToken: hasMore ? String(nextOffset) : null,
      hasMore,
      sourceSyncedAt: new Date(),
    };
  }
}
