import { describe, expect, it } from 'vitest';
import { backoffSeconds } from '../src/utils/time';
import { matchesRule } from '../src/notifications/rule-matcher';
import { assertSafeUrl } from '../src/notifications/ssrf';

describe('重试退避', () => {
  it('按指数增长并受上限约束', () => {
    const first = backoffSeconds(1, 60, 3600, () => 0.5);
    const third = backoffSeconds(3, 60, 3600, () => 0.5);
    expect(first).toBe(60);
    expect(third).toBe(240);
    expect(backoffSeconds(10, 60, 3600, () => 0.5)).toBe(3600);
  });

  it('加入 ±20% 抖动', () => {
    expect(backoffSeconds(2, 60, 3600, () => 0)).toBeCloseTo(96, 5);
    expect(backoffSeconds(2, 60, 3600, () => 1)).toBeCloseTo(144, 5);
  });
});

type Rule = Parameters<typeof matchesRule>[0];

describe('通知规则匹配', () => {
  const base = {
    enabled: 1,
    event_type: 'review.created',
    min_rating: null,
    max_rating: 2,
    application_ids: null,
  } as unknown as Rule;

  it('低星命中、高星跳过', () => {
    expect(matchesRule(base, { applicationId: '1', rating: 1 })).toBe(true);
    expect(matchesRule(base, { applicationId: '1', rating: 5 })).toBe(false);
  });

  it('停用规则永不命中', () => {
    expect(matchesRule({ ...base, enabled: 0 } as Rule, { applicationId: '1', rating: 1 })).toBe(false);
  });

  it('应用白名单生效', () => {
    const rule = { ...base, application_ids: '[11, 22]' } as Rule;
    expect(matchesRule(rule, { applicationId: '22', rating: 2 })).toBe(true);
    expect(matchesRule(rule, { applicationId: '33', rating: 2 })).toBe(false);
  });
});

describe('Webhook SSRF 防护', () => {
  const rejected = [
    'ftp://example.com/hook',
    'http://localhost:3060/hook',
    'http://127.0.0.1/hook',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.5/hook',
    'http://192.168.1.10/hook',
    'http://[::1]/hook',
    'http://user:pass@example.com/hook',
  ];

  for (const url of rejected) {
    it(`拒绝 ${url}`, async () => {
      await expect(assertSafeUrl(url)).rejects.toThrow();
    });
  }

  it('允许公网 https 地址', async () => {
    const parsed = await assertSafeUrl('https://example.com/webhook');
    expect(parsed.hostname).toBe('example.com');
  });
});
