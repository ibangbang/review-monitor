import type { Context } from './types';
import { logger } from '../utils/logger';

/**
 * 定时调度函数（Volcengine FC 定时触发器）
 * 1. 回收过期租约
 * 2. 扫描到期配置创建同步任务（同事务推进 next_sync_at）
 * 3. 分发任务与待发送通知（分发失败保持 pending，下次补偿）
 */
export async function handler(_event: unknown, context: Context) {
  const requestId = context?.requestId ?? 'sched';
  const { schedulerService } = await import('../services/scheduler.service');
  try {
    const summary = await schedulerService.run();
    return { ok: true, requestId, ...summary };
  } catch (error) {
    logger.error('调度执行失败', { requestId, message: (error as Error).message });
    throw error;
  }
}
