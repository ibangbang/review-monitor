import jwt from 'jsonwebtoken';
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

type AppleReview = {
  id: string;
  type: string;
  attributes?: {
    rating?: number;
    title?: string;
    body?: string;
    reviewerNickname?: string;
    territory?: string;
    createdDate?: string;
    developerResponse?: { body?: string; modifiedDate?: string } | null;
  };
};

type AppleResponse = {
  data?: AppleReview[];
  links?: { next?: string };
  meta?: { paging?: { next?: string; total?: number } };
};

export class AppleStoreAdapter implements StoreReviewAdapter {
  readonly storeType: StoreType = 'apple';
  readonly version = '1.0.0';

  private createToken(credential: DecryptedCredential): string {
    const issuerId = requireString(credential, 'issuerId');
    const keyId = requireString(credential, 'keyId');
    const privateKey = requireString(credential, 'privateKey').replace(/\\n/g, '\n');
    return jwt.sign({}, privateKey, {
      algorithm: 'ES256',
      issuer: issuerId,
      subject: optionalString(credential, 'vendorNumber') ?? undefined,
      audience: 'appstoreconnect-v1',
      keyid: keyId,
      expiresIn: '15m',
    });
  }

  validateCredentialShape(credentials: DecryptedCredential): string[] {
    const errors: string[] = [];
    for (const key of ['issuerId', 'keyId', 'privateKey']) {
      const value = credentials[key];
      if (typeof value !== 'string' || value.trim() === '') errors.push(`缺少字段 ${key}`);
    }
    return errors;
  }

  async validateConnection(credentials: DecryptedCredential): Promise<ValidationResult> {
    try {
      const token = this.createToken(credentials);
      const response = await fetchWithTimeout(
        'https://api.appstoreconnect.apple.com/v1/apps?limit=1',
        { headers: { Authorization: `Bearer ${token}` } },
        10000,
      );
      if (!response.ok) {
        return {
          valid: false,
          code: response.status === 401 || response.status === 403 ? 'STORE_AUTH_FAILED' : 'STORE_API_ERROR',
          message: `App Store Connect 返回 ${response.status}`,
        };
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, code: 'STORE_NETWORK_ERROR', message: (error as Error).message };
    }
  }

  async fetchReviews(input: FetchReviewsInput): Promise<FetchReviewsResult> {
    const { storeApp, credential, pageSize } = input;
    const token = this.createToken(credential);
    const params = new URLSearchParams({
      limit: String(Math.min(Math.max(pageSize, 1), 200)),
      sort: '-createdDate',
    });
    if (input.pageToken) params.set('cursor', input.pageToken);
    const url = `https://api.appstoreconnect.apple.com/v1/apps/${encodeURIComponent(
      storeApp.externalAppId,
    )}/customerReviews?${params.toString()}`;

    const response = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new WorkerError(
        response.status === 404 ? 'STORE_APP_NOT_EXIST' : 'STORE_API_ERROR',
        `App Store Connect 返回 ${response.status}: ${body.slice(0, 200)}`,
        response.status === 404 ? 'permanent' : classifyHttpStatus(response.status),
      );
    }

    const payload = (await response.json()) as AppleResponse;
    const reviews: NormalizedReview[] = (payload.data ?? []).map((item) => {
      const attributes = item.attributes ?? {};
      const reply = attributes.developerResponse;
      return {
        externalReviewId: item.id,
        rating: Number(attributes.rating ?? 0),
        title: attributes.title ?? null,
        content: attributes.body ?? null,
        authorName: attributes.reviewerNickname ?? null,
        countryCode: attributes.territory ?? storeApp.countryCode ?? null,
        languageCode: null,
        appVersion: null,
        device: null,
        osVersion: null,
        sourceCreatedAt: attributes.createdDate ? new Date(attributes.createdDate) : new Date(),
        sourceUpdatedAt: null,
        developerReply: reply?.body ?? null,
        developerReplyAt: reply?.modifiedDate ? new Date(reply.modifiedDate) : null,
        raw: attributes as Record<string, unknown>,
      } satisfies NormalizedReview;
    });

    const nextLink = payload.links?.next ?? payload.meta?.paging?.next ?? null;
    const nextToken = nextLink ? this.extractCursor(nextLink) : null;

    return {
      reviews,
      pageToken: nextToken,
      hasMore: Boolean(nextToken),
      sourceSyncedAt: new Date(),
    };
  }

  private extractCursor(link: string): string | null {
    try {
      const url = new URL(link, 'https://api.appstoreconnect.apple.com');
      return url.searchParams.get('cursor');
    } catch {
      return null;
    }
  }
}
