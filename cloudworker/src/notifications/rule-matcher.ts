import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { newPublicId } from '../utils/id';
import type { NotificationChannelRow, NotificationRuleRow } from '../db/types';

function parseIds(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  const ids = parsed.map((item) => String(item)).filter((item) => item.length > 0);
  return ids.length ? ids : null;
}

export function matchesRule(rule: NotificationRuleRow, review: { applicationId: string; rating: number }): boolean {
  if (!rule.enabled) return false;
  if (review.rating < 1 || review.rating > 5) return false;
  if (rule.min_rating !== null && rule.min_rating !== undefined && review.rating < rule.min_rating) return false;
  if (rule.max_rating !== null && rule.max_rating !== undefined && review.rating > rule.max_rating) return false;
  const applications = parseIds(rule.application_ids);
  if (applications && !applications.includes(review.applicationId)) return false;
  return true;
}

export function parseChannelIds(rule: NotificationRuleRow): string[] | null {
  return parseIds(rule.channel_ids);
}

export type OutboxInsert = {
  workspaceId: string;
  channelId: string;
  eventType: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
};

export type ReviewRef = {
  id: string;
  public_id: string;
  workspace_id: string;
  application_id: string;
  rating: number;
};

export async function buildOutboxForReview(
  connection: PoolConnection,
  input: {
    review: ReviewRef;
    reviewPublicId: string;
    eventType: 'review.created' | 'review.updated';
    storeLabel: string;
    storeType: string;
    applicationName: string;
    storeUrl: string | null;
    title: string | null;
    content: string | null;
    authorName: string | null;
    countryCode: string | null;
  },
): Promise<number> {
  const [rules] = await connection.query<NotificationRuleRow[]>(
    `SELECT * FROM notification_rules
     WHERE workspace_id = ? AND enabled = 1 AND event_type = ?`,
    [input.review.workspace_id, input.eventType],
  );
  const matching = rules.filter((rule) =>
    matchesRule(rule, { applicationId: input.review.application_id, rating: input.review.rating }),
  );
  if (!matching.length) return 0;

  const [channels] = await connection.query<NotificationChannelRow[]>(
    `SELECT * FROM notification_channels WHERE workspace_id = ? AND enabled = 1`,
    [input.review.workspace_id],
  );
  if (!channels.length) return 0;

  const ratingStars = '★★★★★'.slice(0, input.review.rating) + '☆☆☆☆☆'.slice(0, 5 - input.review.rating);
  let inserted = 0;

  for (const rule of matching) {
    const allowed = parseChannelIds(rule);
    for (const channel of channels) {
      if (allowed && !allowed.includes(String(channel.id))) continue;
      const dedupeKey = `${input.reviewPublicId}:${input.eventType}:${rule.id}`;
      const payload = {
        eventType: input.eventType,
        title: `${input.applicationName} 收到 ${input.review.rating} 星评价`,
        message: input.content ? input.content.slice(0, 300) : '（无评价内容）',
        reviewId: input.reviewPublicId,
        applicationId: input.review.application_id,
        applicationName: input.applicationName,
        storeType: input.storeType,
        storeLabel: input.storeLabel,
        rating: input.review.rating,
        ratingStars,
        authorName: input.authorName,
        countryCode: input.countryCode,
        reviewTitle: input.title,
        url: input.storeUrl,
        ruleName: rule.name,
      };
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT IGNORE INTO notification_outbox
           (public_id, workspace_id, channel_id, event_type, dedupe_key, payload, status, attempts, max_attempts, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, 5, NOW(6), NOW(6))`,
        [
          newPublicId(),
          input.review.workspace_id,
          channel.id,
          input.eventType,
          dedupeKey,
          JSON.stringify(payload),
        ],
      );
      if (result.affectedRows > 0) inserted += 1;
    }
  }
  return inserted;
}
