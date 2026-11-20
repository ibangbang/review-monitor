import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { adapterRegistry } from '../adapters/registry';
import { DecryptedCredential, STORE_LABELS, StoreAppContext, NormalizedReview } from '../adapters/types';
import { loadConfig } from '../config/env';
import { execute, query, withTransaction } from '../db/mysql';
import type { ReviewRow, ReviewTaskRow, StoreAppRow, StoreSyncConfigRow } from '../db/types';
import { decryptCredential } from '../crypto/credential-crypto';
import { buildOutboxForReview } from '../notifications/rule-matcher';
import { clampErrorMessage, toWorkerError, WorkerError } from '../utils/errors';
import { newPublicId, newRequestId } from '../utils/id';
import { logger } from '../utils/logger';
import { backoffSeconds } from '../utils/time';

export type SyncResult = {
  claimed: boolean;
  taskId: string;
  status?: 'succeeded' | 'pending' | 'failed';
  fetched?: number;
  inserted?: number;
  updated?: number;
  continuationTaskId?: string;
  errorCode?: string;
  errorMessage?: string;
};

type SyncContext = {
  storeApp: StoreAppRow;
  syncConfig: StoreSyncConfigRow | null;
  credential: DecryptedCredential | null;
};

type ResumeState = { pageToken: string | null; since: string | null };

function readResume(cursor: string | null): ResumeState {
  if (!cursor) return { pageToken: null, since: null };
  try {
    const parsed = JSON.parse(cursor) as Partial<ResumeState>;
    return {
      pageToken: typeof parsed.pageToken === 'string' ? parsed.pageToken : null,
      since: typeof parsed.since === 'string' ? parsed.since : null,
    };
  } catch {
    return { pageToken: cursor, since: null };
  }
}

function serializeResume(state: ResumeState): string | null {
  if (!state.pageToken && !state.since) return null;
  return JSON.stringify({ pageToken: state.pageToken, since: state.since });
}

const AUTH_ERROR_CODES = new Set(['STORE_AUTH_FAILED', 'CREDENTIAL_DECRYPT_FAILED', 'STORE_PERMISSION_DENIED']);

export class ReviewSyncService {
  private readonly config = loadConfig();

  async claimTask(taskId: string, requestId: string): Promise<ReviewTaskRow | null> {
    const result = await execute(
      `UPDATE review_tasks
         SET status = 'running',
             attempts = attempts + 1,
             started_at = NOW(),
             locked_until = DATE_ADD(NOW(), INTERVAL ? SECOND),
             worker_request_id = ?,
             error_code = NULL,
             error_message = NULL
       WHERE id = ?
         AND (
           (status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
           OR (status = 'running' AND locked_until IS NOT NULL AND locked_until <= NOW())
         )`,
      [this.config.worker.lockSeconds, requestId, taskId],
    );
    if (result.affectedRows !== 1) return null;
    const rows = await query<ReviewTaskRow>('SELECT * FROM review_tasks WHERE id = ? LIMIT 1', [taskId]);
    return rows[0] ?? null;
  }

  private async loadContext(storeAppId: string): Promise<SyncContext> {
    const rows = await query<StoreAppRow>(
      `SELECT sa.*, a.name AS application_name,
              sc.status AS connection_status, sc.store_type AS connection_type,
              sc.credential_ciphertext, sc.credential_key_version
         FROM store_apps sa
         JOIN applications a ON a.id = sa.application_id
         LEFT JOIN store_connections sc ON sc.id = sa.store_connection_id
        WHERE sa.id = ? LIMIT 1`,
      [storeAppId],
    );
    const storeApp = rows[0];
    if (!storeApp) throw WorkerError.permanent('STORE_APP_NOT_FOUND', '同步绑定的市场应用不存在');
    if (storeApp.status !== 'active') {
      throw WorkerError.permanent('STORE_APP_PAUSED', '市场应用已暂停或归档，跳过本次采集');
    }

    const syncConfigRows = await query<StoreSyncConfigRow>(
      'SELECT * FROM store_sync_configs WHERE store_app_id = ? LIMIT 1',
      [storeApp.id],
    );
    const syncConfig = syncConfigRows[0] ?? null;

    let credential: DecryptedCredential | null = null;
    if (storeApp.store_type === 'mock') {
      credential = {};
    } else {
      if (!storeApp.store_connection_id) {
        throw WorkerError.permanent('STORE_CONNECTION_REQUIRED', '未绑定市场连接，无法采集');
      }
      if (!storeApp.credential_ciphertext || !storeApp.connection_status) {
        throw WorkerError.permanent('STORE_CONNECTION_NOT_FOUND', '市场连接不存在或凭证缺失');
      }
      if (storeApp.connection_status === 'disabled') {
        throw WorkerError.permanent('STORE_CONNECTION_DISABLED', '市场连接已停用');
      }
      if (storeApp.connection_status !== 'active') {
        throw WorkerError.permanent('STORE_CONNECTION_INVALID', '市场连接凭证已失效，请重新授权');
      }
      if (storeApp.connection_type && storeApp.connection_type !== storeApp.store_type) {
        throw WorkerError.permanent('STORE_CONNECTION_INVALID', '市场连接类型与绑定应用不一致');
      }
      try {
        credential = JSON.parse(decryptCredential(storeApp.credential_ciphertext, this.config.credential.encryptionKey)) as DecryptedCredential;
      } catch (error) {
        throw WorkerError.permanent('CREDENTIAL_DECRYPT_FAILED', (error as Error).message);
      }
    }

    return { storeApp, syncConfig, credential };
  }

  private storeAppContext(storeApp: StoreAppRow): StoreAppContext {
    return {
      storeAppId: storeApp.id,
      applicationId: storeApp.application_id,
      workspaceId: storeApp.workspace_id,
      storeType: storeApp.store_type as StoreAppContext['storeType'],
      externalAppId: storeApp.external_app_id,
      countryCode: storeApp.country_code,
      displayName: storeApp.display_name,
    };
  }

  private async startAttempt(task: ReviewTaskRow, requestId: string): Promise<void> {
    await execute(
      `INSERT INTO review_task_attempts (task_id, attempt_no, function_request_id, status, started_at, created_at)
       VALUES (?, ?, ?, 'running', NOW(), NOW(6))`,
      [task.id, task.attempts, requestId.slice(0, 64)],
    );
  }

  private async persistPage(
    task: ReviewTaskRow,
    context: SyncContext,
    reviews: NormalizedReview[],
    resume: ResumeState,
  ): Promise<{ inserted: number; updated: number; fetched: number }> {
    if (!reviews.length) return { inserted: 0, updated: 0, fetched: 0 };
    const storeApp = context.storeApp;

    return withTransaction(async (connection: PoolConnection) => {
      let inserted = 0;
      let updated = 0;

      const externalIds = reviews.map((review) => review.externalReviewId);
      const placeholders = externalIds.map(() => '?').join(',');
      const [existingRows] = await connection.query<ReviewRow[]>(
        `SELECT * FROM reviews WHERE store_app_id = ? AND external_review_id IN (${placeholders})`,
        [storeApp.id, ...externalIds],
      );
      const existing = new Map(existingRows.map((row) => [row.external_review_id, row]));

      for (const review of reviews) {
        const previous = existing.get(review.externalReviewId);
        if (!previous) {
          const publicId = newPublicId();
          const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO reviews
               (public_id, workspace_id, application_id, store_app_id, store_type, external_review_id,
                rating, title, content, author_name, country_code, language_code, app_version, device,
                os_version, source_created_at, source_updated_at, developer_reply, developer_reply_at,
                internal_status, raw_data, first_seen_at, last_synced_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unprocessed', ?, NOW(), NOW(), NOW(6), NOW(6))
             ON DUPLICATE KEY UPDATE last_synced_at = NOW(6)`,
            [
              publicId,
              storeApp.workspace_id,
              storeApp.application_id,
              storeApp.id,
              storeApp.store_type,
              review.externalReviewId,
              review.rating,
              review.title,
              review.content,
              review.authorName,
              review.countryCode,
              review.languageCode,
              review.appVersion,
              review.device,
              review.osVersion,
              review.sourceCreatedAt,
              review.sourceUpdatedAt,
              review.developerReply,
              review.developerReplyAt,
              review.raw ? JSON.stringify(review.raw) : null,
            ],
          );

          if (result.affectedRows === 1) {
            inserted += 1;
            const reviewId = String(result.insertId);
            await connection.query(
              `INSERT INTO review_events (public_id, workspace_id, review_id, event_type, new_values, source, created_at)
               VALUES (?, ?, ?, 'created', ?, 'worker', NOW(6))`,
              [
                newPublicId(),
                storeApp.workspace_id,
                reviewId,
                JSON.stringify({ rating: review.rating, title: review.title, externalReviewId: review.externalReviewId }),
              ],
            );
            await buildOutboxForReview(connection, {
              review: {
                id: reviewId,
                public_id: publicId,
                workspace_id: storeApp.workspace_id,
                application_id: storeApp.application_id,
                rating: review.rating,
              },
              reviewPublicId: publicId,
              eventType: 'review.created',
              storeLabel: STORE_LABELS[storeApp.store_type as keyof typeof STORE_LABELS] ?? storeApp.store_type,
              storeType: storeApp.store_type,
              applicationName: storeApp.application_name ?? storeApp.display_name ?? '应用',
              storeUrl: storeApp.store_url,
              title: review.title,
              content: review.content,
              authorName: review.authorName,
              countryCode: review.countryCode,
            });
          } else {
            updated += 1;
          }
          continue;
        }

        const changed =
          Number(previous.rating) !== review.rating ||
          (previous.title ?? null) !== (review.title ?? null) ||
          (previous.content ?? null) !== (review.content ?? null);

        const [updateResult] = await connection.query<ResultSetHeader>(
          `UPDATE reviews
              SET rating = ?, title = ?, content = ?, author_name = ?, country_code = ?, language_code = ?,
                  app_version = ?, device = ?, os_version = ?, source_created_at = ?, source_updated_at = ?,
                  developer_reply = ?, developer_reply_at = ?, raw_data = ?, last_synced_at = NOW(6), updated_at = NOW(6)
            WHERE id = ?`,
          [
            review.rating,
            review.title,
            review.content,
            review.authorName,
            review.countryCode,
            review.languageCode,
            review.appVersion,
            review.device,
            review.osVersion,
            review.sourceCreatedAt,
            review.sourceUpdatedAt,
            review.developerReply,
            review.developerReplyAt,
            review.raw ? JSON.stringify(review.raw) : null,
            previous.id,
          ],
        );

        if (updateResult.affectedRows > 0) {
          updated += 1;
          if (changed) {
            await connection.query(
              `INSERT INTO review_events (public_id, workspace_id, review_id, event_type, old_values, new_values, source, created_at)
               VALUES (?, ?, ?, 'updated', ?, ?, 'worker', NOW(6))`,
              [
                newPublicId(),
                storeApp.workspace_id,
                previous.id,
                JSON.stringify({ rating: previous.rating }),
                JSON.stringify({ rating: review.rating, title: review.title }),
              ],
            );
            await buildOutboxForReview(connection, {
              review: previous,
              reviewPublicId: previous.public_id,
              eventType: 'review.updated',
              storeLabel: STORE_LABELS[storeApp.store_type as keyof typeof STORE_LABELS] ?? storeApp.store_type,
              storeType: storeApp.store_type,
              applicationName: storeApp.application_name ?? storeApp.display_name ?? '应用',
              storeUrl: storeApp.store_url,
              title: review.title,
              content: review.content,
              authorName: review.authorName,
              countryCode: review.countryCode,
            });
          }
        }
      }

      // 续跑状态与任务计数在同一事务中落库，避免游标先于评价写入推进
      if (context.syncConfig?.id) {
        await connection.query(
          'UPDATE store_sync_configs SET `cursor` = ?, updated_at = NOW(6) WHERE id = ?',
          [serializeResume(resume), context.syncConfig.id],
        );
      }

      return { inserted, updated, fetched: reviews.length };
    });
  }

  private async markSucceeded(
    task: ReviewTaskRow,
    context: SyncContext,
    totals: { fetched: number; inserted: number; updated: number },
    startedAt: number,
  ): Promise<void> {
    await execute(
      `UPDATE review_tasks
          SET status = 'succeeded', finished_at = NOW(), locked_until = NULL, next_retry_at = NULL,
              fetched_count = ?, inserted_count = ?, updated_count = ?, error_code = NULL, error_message = NULL
        WHERE id = ?`,
      [totals.fetched, totals.inserted, totals.updated, task.id],
    );
    await execute(
      `UPDATE review_task_attempts
          SET status = 'succeeded', finished_at = NOW(), duration_ms = ?,
              fetched_count = ?, inserted_count = ?, updated_count = ?
        WHERE task_id = ? AND attempt_no = ?`,
      [Date.now() - startedAt, totals.fetched, totals.inserted, totals.updated, task.id, task.attempts],
    );
    if (context.syncConfig?.id) {
      await execute(
        `UPDATE store_sync_configs
            SET last_synced_at = NOW(), \`cursor\` = ?,
                last_error_at = NULL, last_error_code = NULL, last_error_message = NULL,
                next_sync_at = DATE_ADD(NOW(), INTERVAL interval_minutes MINUTE),
                updated_at = NOW(6)
          WHERE id = ?`,
        [null, context.syncConfig.id],
      );
    }
  }

  private async markFailed(
    task: ReviewTaskRow,
    context: SyncContext,
    error: WorkerError,
    startedAt: number,
    totals: { fetched: number; inserted: number; updated: number },
  ): Promise<'pending' | 'failed'> {
    const retryable = error.errorClass === 'retryable' && task.attempts < task.max_attempts;
    const status: 'pending' | 'failed' = retryable ? 'pending' : 'failed';
    const delay = retryable
      ? backoffSeconds(task.attempts, this.config.worker.retryBaseSeconds, this.config.worker.retryMaxSeconds)
      : 0;
    const nextRetryAt = retryable ? new Date(Date.now() + delay * 1000) : null;

    await execute(
      `UPDATE review_tasks
          SET status = ?, error_code = ?, error_message = ?, locked_until = NULL,
              next_retry_at = ?, finished_at = ?
        WHERE id = ?`,
      [
        status,
        error.code,
        clampErrorMessage(error.message),
        nextRetryAt,
        retryable ? null : new Date(),
        task.id,
      ],
    );
    await execute(
      `UPDATE review_task_attempts
          SET status = 'failed', finished_at = NOW(), duration_ms = ?,
              fetched_count = ?, inserted_count = ?, updated_count = ?, error_code = ?, error_message = ?
        WHERE task_id = ? AND attempt_no = ?`,
      [
        Date.now() - startedAt,
        totals.fetched,
        totals.inserted,
        totals.updated,
        error.code,
        clampErrorMessage(error.message),
        task.id,
        task.attempts,
      ],
    );
    if (context.syncConfig?.id) {
      await execute(
        `UPDATE store_sync_configs
            SET last_error_at = NOW(), last_error_code = ?, last_error_message = ?, updated_at = NOW(6)
          WHERE id = ?`,
        [error.code, clampErrorMessage(error.message), context.syncConfig.id],
      );
    }
    if (AUTH_ERROR_CODES.has(error.code) && context.storeApp.store_connection_id) {
      await execute(
        `UPDATE store_connections
            SET status = 'invalid', last_error_code = ?, last_error_message = ?, last_validated_at = NOW(), updated_at = NOW(6)
          WHERE id = ?`,
        [error.code, clampErrorMessage(error.message), context.storeApp.store_connection_id],
      );
    }
    return status;
  }

  private async createContinuation(
    task: ReviewTaskRow,
    context: SyncContext,
    resume: ResumeState,
  ): Promise<string> {
    const publicId = newPublicId();
    await execute(
      `INSERT INTO review_tasks
         (public_id, workspace_id, store_app_id, task_type, status, priority, attempts, max_attempts, scheduled_at, created_at, updated_at)
       VALUES (?, ?, ?, 'sync_reviews', 'pending', ?, 0, ?, NOW(), NOW(6), NOW(6))`,
      [publicId, task.workspace_id, task.store_app_id, task.priority, task.max_attempts],
    );
    if (context.syncConfig?.id) {
      await execute('UPDATE store_sync_configs SET `cursor` = ?, updated_at = NOW(6) WHERE id = ?', [
        serializeResume(resume),
        context.syncConfig.id,
      ]);
    }
    return publicId;
  }

  async runTask(taskId: string, requestId = newRequestId('task')): Promise<SyncResult> {
    const task = await this.claimTask(taskId, requestId);
    if (!task) {
      logger.info('任务未领取（状态不满足或已被其他执行者领取）', { taskId });
      return { claimed: false, taskId };
    }

    const startedAt = Date.now();
    const totals = { fetched: 0, inserted: 0, updated: 0 };
    let context: SyncContext | null = null;
    await this.startAttempt(task, requestId);

    try {
      context = await this.loadContext(task.store_app_id);
      const adapter = adapterRegistry.get(context.storeApp.store_type);
      const credential = context.credential ?? {};
      const resume = readResume(context.syncConfig?.cursor ?? null);
      const overlapSince = context.syncConfig?.last_synced_at
        ? new Date(new Date(context.syncConfig.last_synced_at).getTime() - this.config.worker.syncOverlapMinutes * 60_000)
        : null;
      const since = resume.since ? new Date(resume.since) : overlapSince;

      let pageToken = resume.pageToken;
      let pages = 0;
      let hasMore = true;

      while (hasMore) {
        if (pages >= this.config.worker.syncMaxPages || Date.now() - startedAt > this.config.worker.timeBudgetMs) {
          const continuationResume: ResumeState = { pageToken, since: since ? since.toISOString() : null };
          const continuationTaskId = await this.createContinuation(task, context, continuationResume);
          await this.markSucceeded(task, context, totals, startedAt);
          logger.info('任务达到单次执行上限，已创建续跑任务', { taskId, continuationTaskId, pages });
          return {
            claimed: true,
            taskId,
            status: 'succeeded',
            ...totals,
            continuationTaskId,
          };
        }

        const page = await adapter.fetchReviews({
          storeApp: this.storeAppContext(context.storeApp),
          credential,
          pageToken,
          since,
          pageSize: this.config.worker.syncPageSize,
        });

        const pageResume: ResumeState = { pageToken: page.pageToken ?? null, since: since ? since.toISOString() : null };
        const pageResult = await this.persistPage(task, context, page.reviews, pageResume);
        totals.fetched += pageResult.fetched;
        totals.inserted += pageResult.inserted;
        totals.updated += pageResult.updated;

        pageToken = page.pageToken ?? null;
        hasMore = page.hasMore && Boolean(pageToken);
        pages += 1;
      }

      await this.markSucceeded(task, context, totals, startedAt);
      logger.info('评价同步完成', { taskId, pages, ...totals });
      return { claimed: true, taskId, status: 'succeeded', ...totals };
    } catch (error) {
      const workerError = toWorkerError(error, 'SYNC_FAILED');
      const status = context
        ? await this.markFailed(task, context, workerError, startedAt, totals)
        : await this.failWithoutContext(task, workerError, startedAt, totals);
      logger.error('评价同步失败', {
        taskId,
        code: workerError.code,
        errorClass: workerError.errorClass,
        message: workerError.message,
        status,
      });
      return {
        claimed: true,
        taskId,
        status,
        ...totals,
        errorCode: workerError.code,
        errorMessage: workerError.message,
      };
    }
  }

  private async failWithoutContext(
    task: ReviewTaskRow,
    error: WorkerError,
    startedAt: number,
    totals: { fetched: number; inserted: number; updated: number },
  ): Promise<'pending' | 'failed'> {
    const retryable = error.errorClass === 'retryable' && task.attempts < task.max_attempts;
    const nextRetryAt = retryable
      ? new Date(
          Date.now() +
            backoffSeconds(task.attempts, this.config.worker.retryBaseSeconds, this.config.worker.retryMaxSeconds) * 1000,
        )
      : null;
    await execute(
      `UPDATE review_tasks SET status = ?, error_code = ?, error_message = ?, locked_until = NULL, next_retry_at = ?, finished_at = ?
        WHERE id = ?`,
      [retryable ? 'pending' : 'failed', error.code, clampErrorMessage(error.message), nextRetryAt, retryable ? null : new Date(), task.id],
    );
    await execute(
      `UPDATE review_task_attempts SET status = 'failed', finished_at = NOW(), duration_ms = ?, error_code = ?, error_message = ?
        WHERE task_id = ? AND attempt_no = ?`,
      [Date.now() - startedAt, error.code, clampErrorMessage(error.message), task.id, task.attempts],
    );
    return retryable ? 'pending' : 'failed';
  }

  async retryTask(taskId: string): Promise<boolean> {
    const result = await execute(
      `UPDATE review_tasks
          SET status = 'pending', next_retry_at = NULL, locked_until = NULL, finished_at = NULL,
              attempts = 0, error_code = NULL, error_message = NULL
        WHERE id = ? AND status IN ('failed', 'cancelled')`,
      [taskId],
    );
    return result.affectedRows === 1;
  }
}

export const reviewSyncService = new ReviewSyncService();
