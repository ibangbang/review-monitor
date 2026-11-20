import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import { DomainException } from '../../common/errors/domain.exception';
import {
  AdminUser,
  Application,
  AuditLog,
  NotificationChannel,
  NotificationOutbox,
  Review,
  ReviewTask,
  ReviewTaskAttempt,
  StoreApp,
  StoreConnection,
  StoreSyncConfig,
  User,
  Workspace,
  WorkspaceMember,
} from '../../database/entities';
import { STORE_LABELS } from '../stores/adapters/store-adapter.types';
import {
  AdminApplicationQueryDto,
  AdminAuditLogQueryDto,
  AdminNotificationQueryDto,
  AdminReviewQueryDto,
  AdminTaskQueryDto,
  AdminUserQueryDto,
  AdminWorkspaceQueryDto,
} from './admin.dto';

export interface AdminAuditMeta {
  adminUserId: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Workspace) private readonly workspaces: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private readonly members: Repository<WorkspaceMember>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(StoreApp) private readonly storeApps: Repository<StoreApp>,
    @InjectRepository(StoreConnection) private readonly connections: Repository<StoreConnection>,
    @InjectRepository(StoreSyncConfig) private readonly syncConfigs: Repository<StoreSyncConfig>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(ReviewTask) private readonly tasks: Repository<ReviewTask>,
    @InjectRepository(ReviewTaskAttempt)
    private readonly taskAttempts: Repository<ReviewTaskAttempt>,
    @InjectRepository(NotificationChannel)
    private readonly channels: Repository<NotificationChannel>,
    @InjectRepository(NotificationOutbox) private readonly outbox: Repository<NotificationOutbox>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
    @InjectDataSource() private readonly dataSource: import('typeorm').DataSource,
  ) {}

  async overview() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [row] = await this.dataSource.query<Array<Record<string, string | null>>>(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM users WHERE status = 'active') AS activeUsers,
         (SELECT COUNT(*) FROM workspaces WHERE status = 'active') AS workspaces,
         (SELECT COUNT(*) FROM applications WHERE status = 'active') AS applications,
         (SELECT COUNT(*) FROM store_apps WHERE status = 'active') AS storeApps,
         (SELECT COUNT(*) FROM reviews) AS reviews,
         (SELECT COUNT(*) FROM reviews WHERE first_seen_at >= ?) AS reviews24h,
         (SELECT COUNT(*) FROM review_tasks WHERE status = 'pending') AS pendingTasks,
         (SELECT COUNT(*) FROM review_tasks WHERE status = 'running') AS runningTasks,
         (SELECT COUNT(*) FROM review_tasks WHERE status = 'failed' AND updated_at >= ?) AS failedTasks24h,
         (SELECT COUNT(*) FROM notification_outbox WHERE status = 'pending') AS pendingNotifications,
         (SELECT COUNT(*) FROM notification_outbox WHERE status = 'failed' AND updated_at >= ?) AS failedNotifications24h,
         (SELECT COUNT(*) FROM store_connections WHERE status = 'invalid') AS invalidConnections,
         (SELECT MAX(last_synced_at) FROM store_sync_configs) AS lastSyncedAt`,
      [since24h, since24h, since24h],
    );
    return {
      asOf: new Date(),
      totals: {
        users: Number(row?.users ?? 0),
        activeUsers: Number(row?.activeUsers ?? 0),
        workspaces: Number(row?.workspaces ?? 0),
        applications: Number(row?.applications ?? 0),
        storeApps: Number(row?.storeApps ?? 0),
        reviews: Number(row?.reviews ?? 0),
        reviews24h: Number(row?.reviews24h ?? 0),
        pendingTasks: Number(row?.pendingTasks ?? 0),
        runningTasks: Number(row?.runningTasks ?? 0),
        failedTasks24h: Number(row?.failedTasks24h ?? 0),
        pendingNotifications: Number(row?.pendingNotifications ?? 0),
        failedNotifications24h: Number(row?.failedNotifications24h ?? 0),
        invalidConnections: Number(row?.invalidConnections ?? 0),
        lastSyncedAt: row?.lastSyncedAt ?? null,
      },
    };
  }

  async listUsers(query: AdminUserQueryDto) {
    const qb = this.users.createQueryBuilder('u');
    if (query.status) qb.andWhere('u.status = :status', { status: query.status });
    if (query.keyword) {
      qb.andWhere('(u.email LIKE :keyword OR u.display_name LIKE :keyword)', {
        keyword: `%${query.keyword.trim()}%`,
      });
    }
    qb.orderBy('u.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((row) => row.id);
    const memberships = ids.length
      ? await this.members
          .createQueryBuilder('m')
          .select('m.user_id', 'userId')
          .addSelect('COUNT(*)', 'count')
          .where('m.user_id IN (:...ids)', { ids })
          .andWhere('m.status = :status', { status: 'active' })
          .groupBy('m.user_id')
          .getRawMany<{ userId: string; count: string }>()
      : [];
    const membershipMap = new Map(memberships.map((row) => [String(row.userId), Number(row.count)]));
    return paginated(
      rows.map((user) => ({
        id: user.publicId,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        workspaceCount: membershipMap.get(user.id) ?? 0,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async listWorkspaces(query: AdminWorkspaceQueryDto) {
    const qb = this.workspaces.createQueryBuilder('w');
    if (query.status) qb.andWhere('w.status = :status', { status: query.status });
    if (query.keyword) qb.andWhere('w.name LIKE :keyword', { keyword: `%${query.keyword.trim()}%` });
    qb.orderBy('w.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((row) => row.id);
    const ownerIds = [...new Set(rows.map((row) => row.ownerUserId))];
    const [owners, appCounts, reviewCounts, memberCounts] = await Promise.all([
      ownerIds.length ? this.users.find({ where: { id: In(ownerIds) } }) : [],
      ids.length
        ? this.dataSource.query<
            Array<{ workspaceId: string; count: string }>
          >(`SELECT workspace_id AS workspaceId, COUNT(*) AS count FROM applications WHERE workspace_id IN (?) GROUP BY workspace_id`, [ids])
        : [],
      ids.length
        ? this.dataSource.query<Array<{ workspaceId: string; count: string }>>(
            `SELECT workspace_id AS workspaceId, COUNT(*) AS count FROM reviews WHERE workspace_id IN (?) GROUP BY workspace_id`,
            [ids],
          )
        : [],
      ids.length
        ? this.dataSource.query<Array<{ workspaceId: string; count: string }>>(
            `SELECT workspace_id AS workspaceId, COUNT(*) AS count FROM workspace_members WHERE workspace_id IN (?) AND status = 'active' GROUP BY workspace_id`,
            [ids],
          )
        : [],
    ]);
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
    const appMap = new Map(appCounts.map((row) => [String(row.workspaceId), Number(row.count)]));
    const reviewMap = new Map(reviewCounts.map((row) => [String(row.workspaceId), Number(row.count)]));
    const memberMap = new Map(memberCounts.map((row) => [String(row.workspaceId), Number(row.count)]));
    return paginated(
      rows.map((workspace) => {
        const owner = ownerById.get(workspace.ownerUserId);
        return {
          id: workspace.publicId,
          name: workspace.name,
          status: workspace.status,
          owner: owner ? { id: owner.publicId, email: owner.email, displayName: owner.displayName } : null,
          applicationCount: appMap.get(workspace.id) ?? 0,
          reviewCount: reviewMap.get(workspace.id) ?? 0,
          memberCount: memberMap.get(workspace.id) ?? 0,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
        };
      }),
      total,
      query.page,
      query.pageSize,
    );
  }

  async listApplications(query: AdminApplicationQueryDto) {
    const qb = this.applications.createQueryBuilder('a');
    if (query.keyword) {
      qb.andWhere(
        '(a.name LIKE :keyword OR a.bundle_id LIKE :keyword OR a.package_name LIKE :keyword)',
        { keyword: `%${query.keyword.trim()}%` },
      );
    }
    if (query.storeType) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM store_apps sa WHERE sa.application_id = a.id AND sa.store_type = :storeType)',
        { storeType: query.storeType },
      );
    }
    qb.orderBy('a.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((row) => row.id);
    const workspaceIds = [...new Set(rows.map((row) => row.workspaceId))];
    const [workspaces, storeApps, reviewCounts] = await Promise.all([
      workspaceIds.length ? this.workspaces.find({ where: { id: In(workspaceIds) } }) : [],
      ids.length ? this.storeApps.find({ where: { applicationId: In(ids) } }) : [],
      ids.length
        ? this.dataSource.query<Array<{ applicationId: string; count: string; avgRating: string | null }>>(
            `SELECT application_id AS applicationId, COUNT(*) AS count, AVG(rating) AS avgRating
               FROM reviews WHERE application_id IN (?) GROUP BY application_id`,
            [ids],
          )
        : [],
    ]);
    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    const storeAppsByApp = new Map<string, StoreApp[]>();
    for (const storeApp of storeApps) {
      const list = storeAppsByApp.get(storeApp.applicationId) ?? [];
      list.push(storeApp);
      storeAppsByApp.set(storeApp.applicationId, list);
    }
    const reviewMap = new Map(reviewCounts.map((row) => [String(row.applicationId), row]));
    return paginated(
      rows.map((application) => {
        const workspace = workspaceById.get(application.workspaceId);
        const review = reviewMap.get(application.id);
        return {
          id: application.publicId,
          name: application.name,
          iconUrl: application.iconUrl,
          bundleId: application.bundleId,
          packageName: application.packageName,
          status: application.status,
          workspace: workspace ? { id: workspace.publicId, name: workspace.name } : null,
          storeApps: (storeAppsByApp.get(application.id) ?? []).map((storeApp) => ({
            id: storeApp.publicId,
            storeType: storeApp.storeType,
            externalAppId: storeApp.externalAppId,
            status: storeApp.status,
          })),
          reviewCount: Number(review?.count ?? 0),
          averageRating: review?.avgRating == null ? null : Number(Number(review.avgRating).toFixed(2)),
          createdAt: application.createdAt,
        };
      }),
      total,
      query.page,
      query.pageSize,
    );
  }

  async listReviews(query: AdminReviewQueryDto) {
    const qb = this.reviews.createQueryBuilder('r');
    if (query.keyword) {
      qb.andWhere('(r.title LIKE :keyword OR r.content LIKE :keyword OR r.author_name LIKE :keyword)', {
        keyword: `%${query.keyword.trim()}%`,
      });
    }
    if (query.storeType) qb.andWhere('r.store_type = :storeType', { storeType: query.storeType });
    if (query.rating !== undefined) qb.andWhere('r.rating = :rating', { rating: query.rating });
    if (query.status) qb.andWhere('r.internal_status = :status', { status: query.status });
    if (query.from) qb.andWhere('r.source_created_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('r.source_created_at <= :to', { to: new Date(query.to) });
    if (query.applicationId) {
      qb.andWhere('r.application_id = (SELECT id FROM applications WHERE public_id = :applicationPublicId)', {
        applicationPublicId: query.applicationId,
      });
    }
    if (query.workspaceId) {
      qb.andWhere('r.workspace_id = (SELECT id FROM workspaces WHERE public_id = :workspacePublicId)', {
        workspacePublicId: query.workspaceId,
      });
    }
    qb.orderBy('r.source_created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    const appIds = [...new Set(rows.map((row) => row.applicationId))];
    const workspaceIds = [...new Set(rows.map((row) => row.workspaceId))];
    const [apps, workspaceRows, summary] = await Promise.all([
      appIds.length ? this.applications.find({ where: { id: In(appIds) } }) : [],
      workspaceIds.length ? this.workspaces.find({ where: { id: In(workspaceIds) } }) : [],
      this.dataSource.query<Array<Record<string, string>>>(`SELECT rating, COUNT(*) AS count FROM reviews GROUP BY rating`),
    ]);
    const appById = new Map(apps.map((app) => [app.id, app]));
    const workspaceById = new Map(workspaceRows.map((workspace) => [workspace.id, workspace]));
    return {
      ...paginated(
        rows.map((review) => {
          const application = appById.get(review.applicationId);
          const workspace = workspaceById.get(review.workspaceId);
          const content = review.content ?? '';
          return {
            id: review.publicId,
            rating: review.rating,
            title: review.title,
            contentExcerpt: content.length > 200 ? `${content.slice(0, 200)}…` : content,
            storeType: review.storeType,
            internalStatus: review.internalStatus,
            countryCode: review.countryCode,
            appVersion: review.appVersion,
            sourceCreatedAt: review.sourceCreatedAt,
            application: application ? { id: application.publicId, name: application.name } : null,
            workspace: workspace ? { id: workspace.publicId, name: workspace.name } : null,
          };
        }),
        total,
        query.page,
        query.pageSize,
      ),
      ratingDistribution: [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: Number(summary.find((entry) => Number(entry.rating) === rating)?.count ?? 0),
      })),
    };
  }

  async listTasks(query: AdminTaskQueryDto) {
    const qb = this.tasks.createQueryBuilder('t');
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.workspaceId) {
      qb.andWhere('t.workspace_id = (SELECT id FROM workspaces WHERE public_id = :workspacePublicId)', {
        workspacePublicId: query.workspaceId,
      });
    }
    if (query.storeAppId) {
      qb.andWhere('t.store_app_id = (SELECT id FROM store_apps WHERE public_id = :storeAppPublicId)', {
        storeAppPublicId: query.storeAppId,
      });
    }
    qb.orderBy('t.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return paginated(
      await this.decorateTasks(rows),
      total,
      query.page,
      query.pageSize,
    );
  }

  async taskDetail(publicId: string) {
    const task = await this.tasks.findOne({ where: { publicId } });
    if (!task) throw DomainException.notFound('REVIEW_TASK_NOT_FOUND', 'Review task not found');
    const [decorated] = await this.decorateTasks([task]);
    const attempts = await this.taskAttempts.find({
      where: { taskId: task.id },
      order: { attemptNo: 'DESC' },
    });
    return {
      ...decorated,
      attempts: attempts.map((attempt) => ({
        attemptNo: attempt.attemptNo,
        status: attempt.status,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        durationMs: attempt.durationMs,
        fetchedCount: attempt.fetchedCount,
        insertedCount: attempt.insertedCount,
        updatedCount: attempt.updatedCount,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage,
      })),
    };
  }

  async retryTask(publicId: string, audit: AdminAuditMeta) {
    const task = await this.tasks.findOne({ where: { publicId } });
    if (!task) throw DomainException.notFound('REVIEW_TASK_NOT_FOUND', 'Review task not found');
    if (task.status !== 'failed' && task.status !== 'cancelled') {
      throw DomainException.conflict('TASK_NOT_RETRYABLE', 'Only failed or cancelled tasks can be retried');
    }
    const before = { status: task.status, attempts: task.attempts, errorCode: task.errorCode };
    task.status = 'pending';
    task.nextRetryAt = new Date();
    task.scheduledAt = new Date();
    task.lockedUntil = null;
    task.workerRequestId = null;
    task.errorCode = null;
    task.errorMessage = null;
    task.finishedAt = null;
    if (task.attempts >= task.maxAttempts) task.maxAttempts = task.attempts + 1;
    await this.tasks.save(task);
    await this.recordAudit(audit, 'review_task.retry', 'review_task', task.publicId, before, {
      status: task.status,
    });
    return this.taskDetail(publicId);
  }

  async integrations() {
    const [connections, storeApps, syncConfigs] = await Promise.all([
      this.connections.find({ order: { createdAt: 'DESC' } }),
      this.storeApps.find(),
      this.syncConfigs.find(),
    ]);
    const workspaceIds = [...new Set(connections.map((connection) => connection.workspaceId))];
    const workspaces = workspaceIds.length
      ? await this.workspaces.find({ where: { id: In(workspaceIds) } })
      : [];
    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    const configByStoreApp = new Map(syncConfigs.map((config) => [config.storeAppId, config]));
    const appCountByConnection = new Map<string, number>();
    for (const storeApp of storeApps) {
      if (!storeApp.storeConnectionId) continue;
      appCountByConnection.set(
        storeApp.storeConnectionId,
        (appCountByConnection.get(storeApp.storeConnectionId) ?? 0) + 1,
      );
    }

    const summaryByType = new Map<
      string,
      { storeType: string; label: string; connections: number; active: number; invalid: number; storeApps: number }
    >();
    for (const storeType of Object.keys(STORE_LABELS)) {
      summaryByType.set(storeType, {
        storeType,
        label: STORE_LABELS[storeType as keyof typeof STORE_LABELS],
        connections: 0,
        active: 0,
        invalid: 0,
        storeApps: 0,
      });
    }
    for (const connection of connections) {
      const entry = summaryByType.get(connection.storeType) ?? {
        storeType: connection.storeType,
        label: connection.storeType,
        connections: 0,
        active: 0,
        invalid: 0,
        storeApps: 0,
      };
      entry.connections += 1;
      if (connection.status === 'active') entry.active += 1;
      if (connection.status === 'invalid') entry.invalid += 1;
      summaryByType.set(connection.storeType, entry);
    }
    for (const storeApp of storeApps) {
      const entry = summaryByType.get(storeApp.storeType);
      if (entry) entry.storeApps += 1;
    }

    return {
      asOf: new Date(),
      summary: [...summaryByType.values()],
      connections: connections.map((connection) => {
        const workspace = workspaceById.get(connection.workspaceId);
        const boundApps = storeApps.filter((app) => app.storeConnectionId === connection.id);
        const lastErrors = boundApps
          .map((app) => configByStoreApp.get(app.id))
          .filter((config): config is StoreSyncConfig => Boolean(config?.lastErrorAt))
          .sort((a, b) => (b.lastErrorAt?.getTime() ?? 0) - (a.lastErrorAt?.getTime() ?? 0));
        return {
          id: connection.publicId,
          name: connection.name,
          storeType: connection.storeType,
          status: connection.status,
          workspace: workspace ? { id: workspace.publicId, name: workspace.name } : null,
          storeAppCount: appCountByConnection.get(connection.id) ?? 0,
          lastValidatedAt: connection.lastValidatedAt,
          lastErrorMessage: connection.lastErrorMessage,
          latestSyncError: lastErrors[0]
            ? {
                at: lastErrors[0].lastErrorAt,
                code: lastErrors[0].lastErrorCode,
                message: lastErrors[0].lastErrorMessage,
              }
            : null,
          createdAt: connection.createdAt,
        };
      }),
    };
  }

  async listNotifications(query: AdminNotificationQueryDto) {
    const qb = this.outbox.createQueryBuilder('o');
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.eventType) qb.andWhere('o.event_type = :eventType', { eventType: query.eventType });
    if (query.workspaceId) {
      qb.andWhere('o.workspace_id = (SELECT id FROM workspaces WHERE public_id = :workspacePublicId)', {
        workspacePublicId: query.workspaceId,
      });
    }
    if (query.channelType) {
      qb.andWhere(
        'o.channel_id IN (SELECT id FROM notification_channels WHERE channel_type = :channelType)',
        { channelType: query.channelType },
      );
    }
    qb.orderBy('o.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    const channelIds = [...new Set(rows.map((row) => row.channelId))];
    const workspaceIds = [...new Set(rows.map((row) => row.workspaceId))];
    const [channels, workspaces] = await Promise.all([
      channelIds.length ? this.channels.find({ where: { id: In(channelIds) } }) : [],
      workspaceIds.length ? this.workspaces.find({ where: { id: In(workspaceIds) } }) : [],
    ]);
    const channelById = new Map(channels.map((channel) => [channel.id, channel]));
    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    return paginated(
      rows.map((row) => {
        const channel = channelById.get(row.channelId);
        const workspace = workspaceById.get(row.workspaceId);
        return {
          id: row.publicId,
          eventType: row.eventType,
          status: row.status,
          attempts: row.attempts,
          maxAttempts: row.maxAttempts,
          sentAt: row.sentAt,
          nextRetryAt: row.nextRetryAt,
          errorCode: row.errorCode,
          errorMessage: row.errorMessage,
          payload: row.payload,
          channel: channel
            ? { id: channel.publicId, name: channel.name, channelType: channel.channelType }
            : null,
          workspace: workspace ? { id: workspace.publicId, name: workspace.name } : null,
          createdAt: row.createdAt,
        };
      }),
      total,
      query.page,
      query.pageSize,
    );
  }

  async retryNotification(publicId: string, audit: AdminAuditMeta) {
    const entry = await this.outbox.findOne({ where: { publicId } });
    if (!entry) {
      throw DomainException.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
    }
    if (entry.status !== 'failed') {
      throw DomainException.conflict('NOTIFICATION_NOT_RETRYABLE', 'Only failed notifications can be retried');
    }
    const before = { status: entry.status, attempts: entry.attempts, errorCode: entry.errorCode };
    entry.status = 'pending';
    entry.nextRetryAt = new Date();
    entry.lockedUntil = null;
    entry.errorCode = null;
    entry.errorMessage = null;
    if (entry.attempts >= entry.maxAttempts) entry.maxAttempts = entry.attempts + 1;
    await this.outbox.save(entry);
    await this.recordAudit(audit, 'notification.retry', 'notification', entry.publicId, before, {
      status: entry.status,
    });
    return { id: entry.publicId, status: entry.status, nextRetryAt: entry.nextRetryAt };
  }

  async systemHealth() {
    const started = Date.now();
    let databaseOk = true;
    let databaseLatencyMs = 0;
    try {
      await this.dataSource.query('SELECT 1');
      databaseLatencyMs = Date.now() - started;
    } catch {
      databaseOk = false;
    }
    const [row] = await this.dataSource.query<Array<Record<string, string | null>>>(
      `SELECT
         (SELECT COUNT(*) FROM review_tasks WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW())) AS pendingTasks,
         (SELECT COUNT(*) FROM review_tasks WHERE status = 'running' AND locked_until < NOW()) AS stuckTasks,
         (SELECT COUNT(*) FROM review_tasks WHERE status = 'failed' AND updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS failedTasks24h,
         (SELECT COUNT(*) FROM notification_outbox WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW())) AS pendingNotifications,
         (SELECT COUNT(*) FROM notification_outbox WHERE status = 'failed' AND updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS failedNotifications24h,
         (SELECT MAX(last_synced_at) FROM store_sync_configs) AS lastSyncedAt,
         (SELECT COUNT(*) FROM store_sync_configs WHERE enabled = 1) AS enabledSyncs`,
    );
    const memory = process.memoryUsage();
    return {
      asOf: new Date(),
      database: { ok: databaseOk, latencyMs: databaseLatencyMs },
      queue: {
        pendingTasks: Number(row?.pendingTasks ?? 0),
        stuckTasks: Number(row?.stuckTasks ?? 0),
        failedTasks24h: Number(row?.failedTasks24h ?? 0),
      },
      notifications: {
        pending: Number(row?.pendingNotifications ?? 0),
        failed24h: Number(row?.failedNotifications24h ?? 0),
      },
      sync: {
        lastSyncedAt: row?.lastSyncedAt ?? null,
        enabledConfigs: Number(row?.enabledSyncs ?? 0),
      },
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round(memory.rss / 1024 / 1024),
        nodeVersion: process.version,
      },
    };
  }

  async listAuditLogs(query: AdminAuditLogQueryDto) {
    const qb = this.auditLogs.createQueryBuilder('log');
    if (query.actorType) qb.andWhere('log.actor_type = :actorType', { actorType: query.actorType });
    if (query.action) qb.andWhere('log.action LIKE :action', { action: `%${query.action}%` });
    if (query.resourceType) qb.andWhere('log.resource_type = :resourceType', { resourceType: query.resourceType });
    if (query.from) qb.andWhere('log.created_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('log.created_at <= :to', { to: new Date(query.to) });
    qb.orderBy('log.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    const adminIds = [...new Set(rows.map((row) => row.adminUserId).filter((id): id is string => Boolean(id)))];
    const userIds = [...new Set(rows.map((row) => row.actorUserId).filter((id): id is string => Boolean(id)))];
    const [admins, users] = await Promise.all([
      adminIds.length ? this.dataSource.getRepository(AdminUser).find({ where: { id: In(adminIds) } }) : [],
      userIds.length ? this.users.find({ where: { id: In(userIds) } }) : [],
    ]);
    const adminById = new Map(admins.map((admin) => [admin.id, admin]));
    const userById = new Map(users.map((user) => [user.id, user]));
    return paginated(
      rows.map((log) => {
        const admin = log.adminUserId ? adminById.get(log.adminUserId) : undefined;
        const user = log.actorUserId ? userById.get(log.actorUserId) : undefined;
        return {
          id: String(log.id),
          actorType: log.actorType,
          actor: admin
            ? { id: admin.publicId, email: admin.email, displayName: admin.displayName }
            : user
              ? { id: user.publicId, email: user.email, displayName: user.displayName }
              : null,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          beforeSummary: log.beforeSummary,
          afterSummary: log.afterSummary,
          ip: log.ip,
          createdAt: log.createdAt,
        };
      }),
      total,
      query.page,
      query.pageSize,
    );
  }

  private async decorateTasks(rows: ReviewTask[]) {
    if (!rows.length) return [];
    const storeAppIds = [...new Set(rows.map((row) => row.storeAppId))];
    const workspaceIds = [...new Set(rows.map((row) => row.workspaceId))];
    const [storeApps, workspaces] = await Promise.all([
      this.storeApps.find({ where: { id: In(storeAppIds) } }),
      this.workspaces.find({ where: { id: In(workspaceIds) } }),
    ]);
    const applicationIds = [...new Set(storeApps.map((storeApp) => storeApp.applicationId))];
    const applications = applicationIds.length
      ? await this.applications.find({ where: { id: In(applicationIds) } })
      : [];
    const storeAppById = new Map(storeApps.map((storeApp) => [storeApp.id, storeApp]));
    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    const applicationById = new Map(applications.map((application) => [application.id, application]));
    return rows.map((task) => {
      const storeApp = storeAppById.get(task.storeAppId);
      const workspace = workspaceById.get(task.workspaceId);
      const application = storeApp ? applicationById.get(storeApp.applicationId) : undefined;
      return {
        id: task.publicId,
        taskType: task.taskType,
        status: task.status,
        priority: task.priority,
        attempts: task.attempts,
        maxAttempts: task.maxAttempts,
        scheduledAt: task.scheduledAt,
        nextRetryAt: task.nextRetryAt,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        lockedUntil: task.lockedUntil,
        fetchedCount: task.fetchedCount,
        insertedCount: task.insertedCount,
        updatedCount: task.updatedCount,
        errorCode: task.errorCode,
        errorMessage: task.errorMessage,
        workspace: workspace ? { id: workspace.publicId, name: workspace.name } : null,
        application: application ? { id: application.publicId, name: application.name } : null,
        storeApp: storeApp
          ? {
              id: storeApp.publicId,
              storeType: storeApp.storeType,
              externalAppId: storeApp.externalAppId,
            }
          : null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    });
  }

  private async recordAudit(
    audit: AdminAuditMeta,
    action: string,
    resourceType: string,
    resourceId: string,
    beforeSummary: Record<string, unknown> | null,
    afterSummary: Record<string, unknown> | null,
  ): Promise<void> {
    await this.auditLogs.save(
      this.auditLogs.create({
        adminUserId: audit.adminUserId,
        actorType: 'admin',
        action,
        resourceType,
        resourceId,
        beforeSummary,
        afterSummary,
        ip: audit.ip ?? null,
        userAgent: audit.userAgent ?? null,
      }),
    );
  }
}
