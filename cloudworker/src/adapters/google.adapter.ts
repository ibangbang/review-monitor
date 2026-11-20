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

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

type GoogleReview = {
  reviewId: string;
  authorName?: string;
  comments?: Array<{
    userComment?: {
      text?: string;
      lastModified?: { seconds?: string | number };
      starRating?: number;
      reviewLanguage?: string;
      appVersionName?: string;
      device?: string;
      androidOsVersion?: number;
      developerComment?: { text?: string; lastModified?: { seconds?: string | number } };
    };
  }>;
};

type GoogleResponse = {
  reviews?: GoogleReview[];
  tokenPagination?: { nextPageToken?: string };
};

export class GoogleStoreAdapter implements StoreReviewAdapter {
  readonly storeType: StoreType = 'google';
  readonly version = '1.0.0';

  private async accessToken(credential: DecryptedCredential): Promise<string> {
    const email = requireString(credential, 'clientEmail');
    const privateKey = requireString(credential, 'privateKey').replace(/\\n/g, '\n');
    const assertion = jwt.sign(
      { scope: 'https://www.googleapis.com/auth/androidpublisher' },
      privateKey,
      { algorithm: 'RS256', issuer: email, audience: TOKEN_URL, expiresIn: '1h' },
    );
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });
    const response = await fetchWithTimeout(
      TOKEN_URL,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
      10000,
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new WorkerError(
        'STORE_AUTH_FAILED',
        `Google OAuth 获取访问令牌失败 ${response.status}: ${text.slice(0, 200)}`,
        'permanent',
      );
    }
    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) {
      throw WorkerError.permanent('STORE_AUTH_FAILED', 'Google OAuth 未返回 access_token');
    }
    return payload.access_token;
  }

  validateCredentialShape(credentials: DecryptedCredential): string[] {
    const errors: string[] = [];
    for (const key of ['clientEmail', 'privateKey']) {
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
    const token = await this.accessToken(credential);
    const params = new URLSearchParams({ maxResults: String(Math.min(Math.max(pageSize, 1), 100)) });
    if (input.pageToken) params.set('token', input.pageToken);
    const translation = optionalString(credential, 'translationLanguage');
    if (translation) params.set('translationLanguage', translation);

    const url = `${API_BASE}/applications/${encodeURIComponent(
      storeApp.externalAppId,
    )}/reviews?${params.toString()}`;
    const response = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new WorkerError(
        response.status === 404 ? 'STORE_APP_NOT_EXIST' : 'STORE_API_ERROR',
        `Google Play 返回 ${response.status}: ${text.slice(0, 200)}`,
        response.status === 404 ? 'permanent' : classifyHttpStatus(response.status),
      );
    }

    const payload = (await response.json()) as GoogleResponse;
    const reviews: NormalizedReview[] = [];
    for (const review of payload.reviews ?? []) {
      const comment = review.comments?.find((item) => item.userComment)?.userComment;
      if (!comment) continue;
      const created = comment.lastModified?.seconds
        ? new Date(Number(comment.lastModified.seconds) * 1000)
        : new Date();
      reviews.push({
        externalReviewId: review.reviewId,
        rating: Number(comment.starRating ?? 0),
        title: null,
        content: comment.text ?? null,
        authorName: review.authorName ?? null,
        countryCode: storeApp.countryCode ?? null,
        languageCode: comment.reviewLanguage ?? null,
        appVersion: comment.appVersionName ?? null,
        device: comment.device ?? null,
        osVersion: comment.androidOsVersion != null ? String(comment.androidOsVersion) : null,
        sourceCreatedAt: created,
        sourceUpdatedAt: created,
        developerReply: comment.developerComment?.text ?? null,
        developerReplyAt: comment.developerComment?.lastModified?.seconds
          ? new Date(Number(comment.developerComment.lastModified.seconds) * 1000)
          : null,
        raw: review as unknown as Record<string, unknown>,
      });
    }

    const nextToken = payload.tokenPagination?.nextPageToken ?? null;
    return {
      reviews,
      pageToken: nextToken,
      hasMore: Boolean(nextToken),
      sourceSyncedAt: new Date(),
    };
  }
}
