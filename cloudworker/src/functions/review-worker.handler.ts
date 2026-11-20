import type { Context, ReviewWorkerEvent } from './types';
import { parseEvent } from './types';
import { logger } from '../utils/logger';

/** 评价同步工作函数：事件体只允许携带 taskId */
export async function handler(event: unknown, context: Context) {
  const payload = parseEvent<ReviewWorkerEvent>(event);
  const taskId = payload.taskId;
  if (!taskId) {
    logger.warn('缺少 taskId，忽略事件');
    return { ok: false, code: 'TASK_ID_REQUIRED' };
  }
  const requestId = payload.requestId ?? context?.requestId ?? 'review-worker';
  const { reviewSyncService } = await import('../services/review-sync.service');
  const result = await reviewSyncService.runTask(String(taskId), requestId);
  return { ok: result.status !== 'failed', requestId, ...result };
}
