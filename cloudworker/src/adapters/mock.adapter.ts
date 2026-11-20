import {
  DecryptedCredential,
  FetchReviewsInput,
  FetchReviewsResult,
  NormalizedReview,
  StoreReviewAdapter,
  StoreType,
  ValidationResult,
} from './types';

const TEMPLATES: Array<{
  rating: number;
  title: string | null;
  content: string;
  language: string;
  author: string;
}> = [
  { rating: 5, title: '非常好用', content: '界面清爽，功能齐全，已经推荐给同事了。', language: 'zh', author: '晨光' },
  { rating: 4, title: '整体不错', content: '功能满足需求，希望后续增加批量导出。', language: 'zh', author: '小林' },
  { rating: 2, title: '经常闪退', content: '更新到最新版本后打开就闪退，麻烦尽快修复。', language: 'zh', author: 'Alex' },
  { rating: 1, title: '登录不上', content: '一直提示网络错误，换了网络也不行。', language: 'zh', author: 'Tina' },
  { rating: 5, title: 'Great app', content: 'Simple and fast, exactly what I needed.', language: 'en', author: 'Chris' },
  { rating: 3, title: '一般', content: '功能够用，但界面有点旧，加载也偏慢。', language: 'zh', author: '老王' },
  { rating: 4, title: 'Good', content: 'Nice experience overall, dark mode would be great.', language: 'en', author: 'Dana' },
  { rating: 2, title: '广告太多', content: '免费版广告太频繁，影响使用。', language: 'zh', author: '阿强' },
];

const VERSIONS = ['2.4.0', '2.3.2', '2.3.0', '2.2.1'];
const DEVICES = ['iPhone 15', 'Pixel 8', 'HUAWEI Mate 60', 'iPhone 13'];
const COUNTRIES = ['US', 'CN', 'JP', 'DE'];
const OS_VERSIONS = ['17.4', '14', '4.2.0', '16.6'];

function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/**
 * 演示用 Adapter：不访问任何外部网络，生成稳定的评价数据。
 * 同一条 externalReviewId 每次生成的字段一致，便于验证幂等 upsert。
 */
export class MockStoreAdapter implements StoreReviewAdapter {
  readonly storeType: StoreType = 'mock';
  readonly version = '1.0.0';
  readonly total = 24;

  validateCredentialShape(_credentials: DecryptedCredential): string[] {
    return [];
  }

  async validateConnection(_credentials: DecryptedCredential): Promise<ValidationResult> {
    return { valid: true, metadata: { mode: 'mock' } };
  }

  async fetchReviews(input: FetchReviewsInput): Promise<FetchReviewsResult> {
    const { storeApp, pageSize, pageToken } = input;
    const offset = pageToken ? Math.max(0, Number.parseInt(pageToken, 10) || 0) : 0;
    const limit = Math.min(Math.max(pageSize, 1), 100);
    const seed = hash(`${storeApp.storeType}:${storeApp.externalAppId}:${storeApp.countryCode}`);
    const now = Date.now();
    const reviews: NormalizedReview[] = [];
    const end = Math.min(offset + limit, this.total);

    for (let index = offset; index < end; index += 1) {
      const template = TEMPLATES[(seed + index) % TEMPLATES.length];
      const daysAgo = (index * 7 + (seed % 5)) % 60;
      const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - (seed % 3600) * 1000);
      if (input.since && createdAt < input.since) continue;
      reviews.push({
        externalReviewId: `mock-${storeApp.externalAppId}-${index}`,
        rating: template.rating,
        title: template.title,
        content: template.content,
        authorName: template.author,
        countryCode: COUNTRIES[(seed + index) % COUNTRIES.length],
        languageCode: template.language,
        appVersion: VERSIONS[(seed + index) % VERSIONS.length],
        device: DEVICES[(seed + index) % DEVICES.length],
        osVersion: OS_VERSIONS[(seed + index) % OS_VERSIONS.length],
        sourceCreatedAt: createdAt,
        sourceUpdatedAt: index % 6 === 0 ? new Date(createdAt.getTime() + 3600 * 1000) : null,
        developerReply: index % 5 === 0 ? '感谢反馈，我们会在下个版本改进。' : null,
        developerReplyAt: index % 5 === 0 ? new Date(createdAt.getTime() + 7200 * 1000) : null,
        raw: { mock: true, index, seed },
      });
    }

    const hasMore = end < this.total;
    return {
      reviews,
      pageToken: hasMore ? String(end) : null,
      hasMore,
      sourceSyncedAt: new Date(),
    };
  }
}
