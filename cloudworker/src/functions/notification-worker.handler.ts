import type { Context, NotificationWorkerEvent } from './types';
import { parseEvent } from './types';
import { logger } from '../utils/logger';

/** 通知发送工作函数：事件体只允许携带 outboxId */
export async function handler(event: unknown, context: Context) {
  const payload = parseEvent<NotificationWorkerEvent>(event);
  const outboxId = payload.outboxId;
  if (!outboxId) {
    logger.warn('缺少 outboxId，忽略事件');
    return { ok: false, code: 'OUTBOX_ID_REQUIRED' };
  }
  const requestId = payload.requestId ?? context?.requestId ?? 'notification-worker';
  const { notificationService } = await import('../services/notification.service');
  const result = await notificationService.run(String(outboxId), requestId);
  return { ok: result.status !== 'failed', requestId, ...result };
}
