import { createHmac } from 'node:crypto';
import { loadConfig } from '../config/env';
import { logger } from '../utils/logger';

export type DispatchMode = 'inline' | 'http' | 'queued';

function sign(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function postTrigger(url: string, body: Record<string, unknown>): Promise<boolean> {
  const config = loadConfig();
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (config.worker.internalTriggerSecret) {
    const timestamp = String(Date.now());
    headers['x-internal-timestamp'] = timestamp;
    headers['x-internal-signature'] = sign(config.worker.internalTriggerSecret, timestamp, raw);
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: raw,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      logger.warn('函数分发失败', { url, status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn('函数分发异常，任务保持 pending 等待补偿', { url, message: (error as Error).message });
    return false;
  }
}

export function hasRemoteTrigger(kind: 'review' | 'notification'): boolean {
  const config = loadConfig();
  return Boolean(kind === 'review' ? config.worker.triggerUrl : config.worker.notificationTriggerUrl);
}

export async function dispatchReviewTask(taskId: string, requestId: string): Promise<DispatchMode> {
  const config = loadConfig();
  if (!config.worker.triggerUrl) {
    const { reviewSyncService } = await import('./review-sync.service');
    await reviewSyncService.runTask(taskId, requestId);
    return 'inline';
  }
  const ok = await postTrigger(config.worker.triggerUrl, { taskId, requestId });
  return ok ? 'http' : 'queued';
}

export async function dispatchNotification(outboxId: string, requestId: string): Promise<DispatchMode> {
  const config = loadConfig();
  if (!config.worker.notificationTriggerUrl) {
    const { notificationService } = await import('./notification.service');
    await notificationService.run(outboxId, requestId);
    return 'inline';
  }
  const ok = await postTrigger(config.worker.notificationTriggerUrl, { outboxId, requestId });
  return ok ? 'http' : 'queued';
}
