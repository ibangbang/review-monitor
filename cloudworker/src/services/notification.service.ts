import { loadConfig } from '../config/env';
import { execute, query } from '../db/mysql';
import type { NotificationOutboxRow } from '../db/types';
import { decryptCredential } from '../crypto/credential-crypto';
import { ChannelConfig, NotificationPayload, sendNotification } from '../notifications/sender';
import { clampErrorMessage, toWorkerError, WorkerError } from '../utils/errors';
import { newRequestId } from '../utils/id';
import { logger } from '../utils/logger';
import { backoffSeconds } from '../utils/time';
import type { ResultSetHeader } from 'mysql2/promise';

export type NotificationResult = {
  claimed: boolean;
  outboxId: string;
  status?: 'sent' | 'pending' | 'failed';
  errorCode?: string;
  errorMessage?: string;
};

function buildPayload(raw: unknown): NotificationPayload {
  const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
  const rating = Number(data.rating ?? 0);
  const fields: Array<{ label: string; value: string }> = [];
  if (data.ratingStars) fields.push({ label: '评分', value: String(data.ratingStars) });
  if (data.storeLabel) fields.push({ label: '市场', value: String(data.storeLabel) });
  if (data.authorName) fields.push({ label: '用户', value: String(data.authorName) });
  if (data.countryCode) fields.push({ label: '地区', value: String(data.countryCode) });
  if (data.reviewTitle) fields.push({ label: '标题', value: String(data.reviewTitle) });

  return {
    eventType: String(data.eventType ?? 'review.created'),
    title: String(data.title ?? (rating ? `${rating} 星评价` : '新评价通知')),
    message: String(data.message ?? ''),
    url: data.url ? String(data.url) : null,
    fields,
  };
}

export class NotificationService {
  private readonly config = loadConfig();

  async claim(outboxId: string): Promise<NotificationOutboxRow | null> {
    const result = await execute(
      `UPDATE notification_outbox
          SET status = 'running',
              attempts = attempts + 1,
              locked_until = DATE_ADD(NOW(), INTERVAL ? SECOND),
              error_code = NULL,
              error_message = NULL
        WHERE id = ?
          AND (
            (status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
            OR (status = 'running' AND locked_until IS NOT NULL AND locked_until <= NOW())
          )`,
      [this.config.worker.lockSeconds, outboxId],
    );
    if (result.affectedRows !== 1) return null;
    const rows = await query<NotificationOutboxRow>(
      `SELECT o.*, c.channel_type, c.name AS channel_name, c.enabled AS channel_enabled,
              c.config_ciphertext, c.config_key_version
         FROM notification_outbox o
         JOIN notification_channels c ON c.id = o.channel_id
        WHERE o.id = ? LIMIT 1`,
      [outboxId],
    );
    return rows[0] ?? null;
  }

  private async startAttempt(outbox: NotificationOutboxRow, requestId: string): Promise<void> {
    await execute(
      `INSERT INTO notification_attempts (outbox_id, attempt_no, status, started_at, created_at)
       VALUES (?, ?, 'running', NOW(), NOW(6))`,
      [outbox.id, outbox.attempts],
    );
    logger.debug('通知发送开始', { outboxId: outbox.public_id, attempt: outbox.attempts, requestId });
  }

  async run(outboxId: string, requestId = newRequestId('notify')): Promise<NotificationResult> {
    const outbox = await this.claim(outboxId);
    if (!outbox) {
      logger.info('通知任务未领取（状态不满足）', { outboxId });
      return { claimed: false, outboxId };
    }
    await this.startAttempt(outbox, requestId);
    const startedAt = Date.now();

    try {
      if (!outbox.channel_type || !outbox.config_ciphertext) {
        throw WorkerError.permanent('NOTIFICATION_CHANNEL_MISSING', '通知渠道不存在或已删除');
      }
      if (outbox.channel_enabled === 0) {
        throw WorkerError.permanent('NOTIFICATION_CHANNEL_DISABLED', '通知渠道已停用');
      }
      const config = JSON.parse(
        decryptCredential(outbox.config_ciphertext, this.config.credential.encryptionKey),
      ) as ChannelConfig;
      const payload = buildPayload(outbox.payload);
      await sendNotification(outbox.channel_type, config, payload);

      await execute(
        `UPDATE notification_outbox
            SET status = 'sent', sent_at = NOW(), locked_until = NULL, next_retry_at = NULL,
                error_code = NULL, error_message = NULL, updated_at = NOW(6)
          WHERE id = ?`,
        [outbox.id],
      );
      await execute(
        `UPDATE notification_attempts SET status = 'succeeded', finished_at = NOW(), duration_ms = ?
          WHERE outbox_id = ? AND attempt_no = ?`,
        [Date.now() - startedAt, outbox.id, outbox.attempts],
      );
      logger.info('通知发送成功', { outboxId: outbox.public_id, channel: outbox.channel_type });
      return { claimed: true, outboxId, status: 'sent' };
    } catch (error) {
      const workerError = toWorkerError(error, 'NOTIFICATION_SEND_FAILED');
      const retryable = workerError.errorClass === 'retryable' && outbox.attempts < outbox.max_attempts;
      const nextRetryAt = retryable
        ? new Date(
            Date.now() +
              backoffSeconds(outbox.attempts, this.config.worker.retryBaseSeconds, this.config.worker.retryMaxSeconds) *
                1000,
          )
        : null;
      await execute(
        `UPDATE notification_outbox
            SET status = ?, error_code = ?, error_message = ?, locked_until = NULL, next_retry_at = ?, updated_at = NOW(6)
          WHERE id = ?`,
        [
          retryable ? 'pending' : 'failed',
          workerError.code,
          clampErrorMessage(workerError.message),
          nextRetryAt,
          outbox.id,
        ],
      );
      await execute(
        `UPDATE notification_attempts
            SET status = 'failed', finished_at = NOW(), duration_ms = ?, error_code = ?, error_message = ?
          WHERE outbox_id = ? AND attempt_no = ?`,
        [
          Date.now() - startedAt,
          workerError.code,
          clampErrorMessage(workerError.message),
          outbox.id,
          outbox.attempts,
        ],
      );
      logger.error('通知发送失败', {
        outboxId: outbox.public_id,
        code: workerError.code,
        errorClass: workerError.errorClass,
        message: workerError.message,
        retryable,
      });
      return {
        claimed: true,
        outboxId,
        status: retryable ? 'pending' : 'failed',
        errorCode: workerError.code,
        errorMessage: workerError.message,
      };
    }
  }

  async retry(outboxId: string): Promise<boolean> {
    const result: ResultSetHeader = await execute(
      `UPDATE notification_outbox
          SET status = 'pending', attempts = 0, next_retry_at = NULL, locked_until = NULL,
              error_code = NULL, error_message = NULL, updated_at = NOW(6)
        WHERE id = ? AND status = 'failed'`,
      [outboxId],
    );
    return result.affectedRows === 1;
  }
}

export const notificationService = new NotificationService();
