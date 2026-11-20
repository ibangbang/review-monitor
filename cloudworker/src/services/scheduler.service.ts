import type { PoolConnection } from 'mysql2/promise';
import { loadConfig } from '../config/env';
import { query, withTransaction } from '../db/mysql';
import type { RowDataPacket } from 'mysql2/promise';
import { newPublicId, newRequestId } from '../utils/id';
import { logger } from '../utils/logger';
import { dispatchNotification, dispatchReviewTask } from './dispatcher';

export type SchedulerSummary = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  createdTasks: number;
  skippedConfigs: number;
  recoveredTasks: number;
  recoveredNotifications: number;
  dispatchedTasks: number;
  dispatchedNotifications: number;
  cleanedTasks: number;
  cleanedNotifications: number;
};

type DueConfigRow = RowDataPacket & {
  config_id: string;
  workspace_id: string;
  store_app_id: string;
  interval_minutes: number;
  store_type: string;
  has_active_task: number;
};

export class SchedulerService {
  private readonly config = loadConfig();

  /** 租约过期、执行者崩溃的任务和通知重新排队 */
  async recoverExpiredLeases(): Promise<{ tasks: number; notifications: number }> {
    const taskRes = await withTransaction(async (connection: PoolConnection) => {
      const [rows] = await connection.query<Array<RowDataPacket & { id: string; attempts: number; max_attempts: number }>>(
        `SELECT id, attempts, max_attempts FROM review_tasks
          WHERE status = 'running' AND locked_until IS NOT NULL AND locked_until < NOW()
          LIMIT 200 FOR UPDATE SKIP LOCKED`,
      );
      let requeued = 0;
      for (const row of rows) {
        if (Number(row.attempts) >= Number(row.max_attempts)) {
          await connection.query(
            `UPDATE review_tasks
                SET status = 'failed', error_code = 'LEASE_EXPIRED', error_message = '任务租约过期且已达最大重试次数',
                    locked_until = NULL, finished_at = NOW()
              WHERE id = ?`,
            [row.id],
          );
          await connection.query(
            `UPDATE review_task_attempts SET status = 'failed', finished_at = NOW(), error_code = 'LEASE_EXPIRED',
                    error_message = '执行超时或被中断'
              WHERE task_id = ? AND status = 'running'`,
            [row.id],
          );
        } else {
          await connection.query(
            `UPDATE review_tasks
                SET status = 'pending', locked_until = NULL, next_retry_at = NOW(),
                    error_code = 'LEASE_EXPIRED', error_message = '任务租约过期，已重新排队'
              WHERE id = ?`,
            [row.id],
          );
          await connection.query(
            `UPDATE review_task_attempts SET status = 'failed', finished_at = NOW(), error_code = 'LEASE_EXPIRED',
                    error_message = '执行超时或被中断，稍后重试'
              WHERE task_id = ? AND status = 'running'`,
            [row.id],
          );
          requeued += 1;
        }
      }
      return requeued;
    });

    const notificationRes = await withTransaction(async (connection: PoolConnection) => {
      const [rows] = await connection.query<Array<RowDataPacket & { id: string; attempts: number; max_attempts: number }>>(
        `SELECT id, attempts, max_attempts FROM notification_outbox
          WHERE status = 'running' AND locked_until IS NOT NULL AND locked_until < NOW()
          LIMIT 200 FOR UPDATE SKIP LOCKED`,
      );
      let requeued = 0;
      for (const row of rows) {
        if (Number(row.attempts) >= Number(row.max_attempts)) {
          await connection.query(
            `UPDATE notification_outbox
                SET status = 'failed', error_code = 'LEASE_EXPIRED', error_message = '发送租约过期且已达最大重试次数',
                    locked_until = NULL, updated_at = NOW(6)
              WHERE id = ?`,
            [row.id],
          );
        } else {
          await connection.query(
            `UPDATE notification_outbox
                SET status = 'pending', locked_until = NULL, next_retry_at = NOW(),
                    error_code = 'LEASE_EXPIRED', error_message = '发送租约过期，已重新排队', updated_at = NOW(6)
              WHERE id = ?`,
            [row.id],
          );
          requeued += 1;
        }
        await connection.query(
          `UPDATE notification_attempts SET status = 'failed', finished_at = NOW(), error_code = 'LEASE_EXPIRED',
                  error_message = '发送超时或被中断'
            WHERE outbox_id = ? AND status = 'running'`,
          [row.id],
        );
      }
      return requeued;
    });

    return { tasks: taskRes, notifications: notificationRes };
  }

  /** 扫描到期同步配置并创建任务，同一事务内推进 next_sync_at */
  async createDueTasks(): Promise<{ created: string[]; skipped: number }> {
    return withTransaction(async (connection: PoolConnection) => {
      const [rows] = await connection.query<DueConfigRow[]>(
        `SELECT c.id AS config_id, c.workspace_id, c.store_app_id, c.interval_minutes,
                sa.store_type,
                EXISTS(
                  SELECT 1 FROM review_tasks t
                   WHERE t.store_app_id = c.store_app_id AND t.status IN ('pending', 'running')
                ) AS has_active_task
           FROM store_sync_configs c
           JOIN store_apps sa ON sa.id = c.store_app_id
           LEFT JOIN store_connections sc ON sc.id = sa.store_connection_id
          WHERE c.enabled = 1
            AND c.next_sync_at IS NOT NULL
            AND c.next_sync_at <= NOW()
            AND sa.status = 'active'
            AND (sa.store_type = 'mock' OR (sc.id IS NOT NULL AND sc.status = 'active'))
          ORDER BY c.next_sync_at ASC
          LIMIT ?
          FOR UPDATE OF c SKIP LOCKED`,
        [this.config.worker.schedulerBatchSize],
      );

      const created: string[] = [];
      let skipped = 0;

      for (const row of rows) {
        const hasActive = Number(row.has_active_task) > 0;
        if (hasActive) {
          skipped += 1;
        } else {
          const publicId = newPublicId();
          await connection.query(
            `INSERT INTO review_tasks
               (public_id, workspace_id, store_app_id, task_type, status, priority, attempts, max_attempts, scheduled_at, created_at, updated_at)
             VALUES (?, ?, ?, 'sync_reviews', 'pending', 0, 0, 5, NOW(), NOW(6), NOW(6))`,
            [publicId, row.workspace_id, row.store_app_id],
          );
          const [inserted] = await connection.query<Array<RowDataPacket & { id: string }>>(
            'SELECT id FROM review_tasks WHERE public_id = ? LIMIT 1',
            [publicId],
          );
          if (inserted[0]) created.push(String(inserted[0].id));
        }
        await connection.query(
          `UPDATE store_sync_configs
              SET next_sync_at = DATE_ADD(NOW(), INTERVAL interval_minutes MINUTE),
                  last_started_at = NOW(), updated_at = NOW(6)
            WHERE id = ?`,
          [row.config_id],
        );
      }

      return { created, skipped };
    });
  }

  /** 补偿扫描：一次性 pending 任务（分发失败或新创建） */
  async duePendingTaskIds(limit: number): Promise<string[]> {
    const rows = await query<RowDataPacket & { id: string }>(
      `SELECT id FROM review_tasks
        WHERE status = 'pending'
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
          AND scheduled_at <= NOW()
        ORDER BY priority DESC, scheduled_at ASC
        LIMIT ?`,
      [limit],
    );
    return rows.map((row) => String(row.id));
  }

  async duePendingNotificationIds(limit: number): Promise<string[]> {
    const rows = await query<RowDataPacket & { id: string }>(
      `SELECT id FROM notification_outbox
        WHERE status = 'pending'
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY created_at ASC
        LIMIT ?`,
      [limit],
    );
    return rows.map((row) => String(row.id));
  }

  /** 归档：清理超过保留期的已完成任务与已发送通知 */
  async cleanupRetention(): Promise<{ tasks: number; notifications: number }> {
    const days = this.config.worker.taskRetentionDays;
    if (!Number.isFinite(days) || days <= 0) return { tasks: 0, notifications: 0 };

    const taskIds = await query<RowDataPacket & { id: string }>(
      `SELECT id FROM review_tasks
        WHERE status IN ('succeeded', 'failed', 'cancelled')
          AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        LIMIT 500`,
      [days],
    );
    for (const row of taskIds) {
      await query('DELETE FROM review_task_attempts WHERE task_id = ?', [row.id]);
      await query('DELETE FROM review_tasks WHERE id = ?', [row.id]);
    }

    const outboxIds = await query<RowDataPacket & { id: string }>(
      `SELECT id FROM notification_outbox
        WHERE status IN ('sent', 'failed', 'cancelled')
          AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        LIMIT 500`,
      [days],
    );
    for (const row of outboxIds) {
      await query('DELETE FROM notification_attempts WHERE outbox_id = ?', [row.id]);
      await query('DELETE FROM notification_outbox WHERE id = ?', [row.id]);
    }

    return { tasks: taskIds.length, notifications: outboxIds.length };
  }

  async run(): Promise<SchedulerSummary> {
    const startedAt = new Date();
    const recovery = await this.recoverExpiredLeases();
    const { created, skipped } = await this.createDueTasks();

    const taskIds = new Set(created);
    for (const id of await this.duePendingTaskIds(this.config.worker.workerBatchSize * 4)) {
      taskIds.add(id);
    }
    let dispatchedTasks = 0;
    for (const taskId of taskIds) {
      const mode = await dispatchReviewTask(taskId, newRequestId('sched'));
      if (mode !== 'queued') dispatchedTasks += 1;
    }

    const outboxIds = await this.duePendingNotificationIds(this.config.worker.workerBatchSize * 8);
    let dispatchedNotifications = 0;
    for (const outboxId of outboxIds) {
      const mode = await dispatchNotification(outboxId, newRequestId('sched'));
      if (mode !== 'queued') dispatchedNotifications += 1;
    }

    const cleanup = await this.cleanupRetention();
    const finishedAt = new Date();
    const summary: SchedulerSummary = {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      createdTasks: created.length,
      skippedConfigs: skipped,
      recoveredTasks: recovery.tasks,
      recoveredNotifications: recovery.notifications,
      dispatchedTasks,
      dispatchedNotifications,
      cleanedTasks: cleanup.tasks,
      cleanedNotifications: cleanup.notifications,
    };
    logger.info('调度完成', summary);
    return summary;
  }
}

export const schedulerService = new SchedulerService();
