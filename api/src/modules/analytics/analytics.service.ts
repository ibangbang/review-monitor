import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DomainException } from '../../common/errors/domain.exception';
import { Application } from '../../database/entities';
import {
  AnalyticsRangeQueryDto,
  ComparisonQueryDto,
  DistributionQueryDto,
  SyncHealthQueryDto,
  TrendQueryDto,
} from './analytics.dto';

interface Range {
  from: Date;
  to: Date;
}

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
  ) {}

  async overview(workspaceId: string, query: AnalyticsRangeQueryDto) {
    const range = this.resolveRange(query);
    const applicationId = await this.resolveApplication(workspaceId, query.applicationId);
    const scopeSql = applicationId ? ' AND application_id = ?' : '';
    const scopeParams = applicationId ? [applicationId] : [];

    const [current] = await this.dataSource.query<Array<Record<string, string | null>>>(
      `SELECT COUNT(*) AS reviewCount,
              COALESCE(SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END), 0) AS lowRatingCount,
              AVG(rating) AS averageRating
         FROM reviews
        WHERE workspace_id = ? AND source_created_at >= ? AND source_created_at <= ?${scopeSql}`,
      [workspaceId, range.from, range.to, ...scopeParams],
    );

    const span = range.to.getTime() - range.from.getTime();
    const previousFrom = new Date(range.from.getTime() - span);
    const [previous] = await this.dataSource.query<Array<Record<string, string>>>(
      `SELECT COUNT(*) AS reviewCount
         FROM reviews
        WHERE workspace_id = ? AND source_created_at >= ? AND source_created_at < ?${scopeSql}`,
      [workspaceId, previousFrom, range.from, ...scopeParams],
    );

    const [pending] = await this.dataSource.query<Array<Record<string, string>>>(
      `SELECT COUNT(*) AS pendingCount
         FROM reviews
        WHERE workspace_id = ? AND internal_status IN ('unprocessed', 'processing')${scopeSql}`,
      [workspaceId, ...scopeParams],
    );

    const [counts] = await this.dataSource.query<Array<Record<string, string>>>(
      `SELECT
         (SELECT COUNT(*) FROM applications WHERE workspace_id = ? AND status = 'active') AS applicationCount,
         (SELECT COUNT(*) FROM store_apps WHERE workspace_id = ? AND status = 'active') AS storeAppCount`,
      [workspaceId, workspaceId],
    );

    const [sync] = await this.dataSource.query<Array<{ lastSyncedAt: Date | null }>>(
      `SELECT MAX(last_synced_at) AS lastSyncedAt
         FROM store_sync_configs
        WHERE workspace_id = ?`,
      [workspaceId],
    );

    const reviewCount = Number(current?.reviewCount ?? 0);
    const previousCount = Number(previous?.reviewCount ?? 0);
    const lowRatingCount = Number(current?.lowRatingCount ?? 0);

    return {
      asOf: new Date(),
      range: { from: range.from, to: range.to },
      scope: { applicationId: query.applicationId ?? null },
      totals: {
        reviewCount,
        previousReviewCount: previousCount,
        changePercent:
          previousCount === 0
            ? null
            : Number((((reviewCount - previousCount) / previousCount) * 100).toFixed(1)),
        lowRatingCount,
        lowRatingRatio:
          reviewCount === 0 ? null : Number(((lowRatingCount / reviewCount) * 100).toFixed(1)),
        averageRating:
          current?.averageRating == null ? null : Number(Number(current.averageRating).toFixed(2)),
        pendingCount: Number(pending?.pendingCount ?? 0),
        applicationCount: Number(counts?.applicationCount ?? 0),
        storeAppCount: Number(counts?.storeAppCount ?? 0),
        lastSyncedAt: sync?.lastSyncedAt ?? null,
      },
    };
  }

  async trend(workspaceId: string, query: TrendQueryDto) {
    const range = this.resolveRange(query);
    const applicationId = await this.resolveApplication(workspaceId, query.applicationId);
    const granularity = query.granularity ?? 'day';
    const bucket =
      granularity === 'week'
        ? "DATE_FORMAT(source_created_at, '%x-W%v')"
        : "DATE_FORMAT(source_created_at, '%Y-%m-%d')";
    const params: unknown[] = [workspaceId, range.from, range.to];
    let scopeSql = '';
    if (applicationId) {
      scopeSql = ' AND application_id = ?';
      params.push(applicationId);
    }
    const rows = await this.dataSource.query<Array<Record<string, string | null>>>(
      `SELECT ${bucket} AS bucket,
              COUNT(*) AS reviewCount,
              AVG(rating) AS averageRating,
              COALESCE(SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END), 0) AS lowRatingCount
         FROM reviews
        WHERE workspace_id = ? AND source_created_at >= ? AND source_created_at <= ?${scopeSql}
        GROUP BY bucket
        ORDER BY bucket ASC`,
      params,
    );
    return {
      asOf: new Date(),
      range: { from: range.from, to: range.to },
      granularity,
      scope: { applicationId: query.applicationId ?? null },
      points: rows.map((row) => ({
        bucket: row.bucket,
        reviewCount: Number(row.reviewCount ?? 0),
        averageRating: row.averageRating == null ? null : Number(Number(row.averageRating).toFixed(2)),
        lowRatingCount: Number(row.lowRatingCount ?? 0),
      })),
    };
  }

  async distribution(workspaceId: string, query: DistributionQueryDto) {
    const range = this.resolveRange(query);
    const applicationId = await this.resolveApplication(workspaceId, query.applicationId);
    const params: unknown[] = [workspaceId, range.from, range.to];
    let scopeSql = '';
    if (applicationId) {
      scopeSql = ' AND application_id = ?';
      params.push(applicationId);
    }
    const rows = await this.dataSource.query<Array<Record<string, string>>>(
      `SELECT rating, COUNT(*) AS reviewCount
         FROM reviews
        WHERE workspace_id = ? AND source_created_at >= ? AND source_created_at <= ?${scopeSql}
        GROUP BY rating`,
      params,
    );
    const counts = new Map(rows.map((row) => [Number(row.rating), Number(row.reviewCount)]));
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    const buckets = [5, 4, 3, 2, 1].map((rating) => {
      const reviewCount = counts.get(rating) ?? 0;
      return {
        rating,
        reviewCount,
        ratio: total === 0 ? null : Number(((reviewCount / total) * 100).toFixed(1)),
      };
    });
    const weighted =
      total === 0
        ? null
        : [...counts.entries()].reduce((sum, [rating, count]) => sum + rating * count, 0) / total;
    return {
      asOf: new Date(),
      range: { from: range.from, to: range.to },
      scope: { applicationId: query.applicationId ?? null },
      total,
      averageRating: weighted == null ? null : Number(weighted.toFixed(2)),
      buckets,
    };
  }

  async comparison(workspaceId: string, query: ComparisonQueryDto) {
    const range = this.resolveRange(query);
    const rows = await this.dataSource.query<Array<Record<string, string | null>>>(
      `SELECT a.public_id AS id,
              a.name,
              a.icon_url AS iconUrl,
              COUNT(r.id) AS reviewCount,
              AVG(r.rating) AS averageRating,
              COALESCE(SUM(CASE WHEN r.rating <= 2 THEN 1 ELSE 0 END), 0) AS lowRatingCount
         FROM applications a
         LEFT JOIN reviews r
           ON r.application_id = a.id
          AND r.source_created_at >= ?
          AND r.source_created_at <= ?
        WHERE a.workspace_id = ? AND a.status = 'active'
        GROUP BY a.id, a.public_id, a.name, a.icon_url
        ORDER BY reviewCount DESC, a.name ASC`,
      [range.from, range.to, workspaceId],
    );
    return {
      asOf: new Date(),
      range: { from: range.from, to: range.to },
      applications: rows.map((row) => ({
        id: row.id,
        name: row.name,
        iconUrl: row.iconUrl,
        reviewCount: Number(row.reviewCount ?? 0),
        averageRating: row.averageRating == null ? null : Number(Number(row.averageRating).toFixed(2)),
        lowRatingCount: Number(row.lowRatingCount ?? 0),
      })),
    };
  }

  async syncHealth(workspaceId: string, query: SyncHealthQueryDto) {
    const applicationId = await this.resolveApplication(workspaceId, query.applicationId);
    const params: unknown[] = [workspaceId];
    let filterSql = '';
    if (applicationId) {
      filterSql = ' AND sa.application_id = ?';
      params.push(applicationId);
    }
    const rows = await this.dataSource.query<Array<Record<string, string | null>>>(
      `SELECT sa.public_id AS id,
              sa.store_type AS storeType,
              sa.external_app_id AS externalAppId,
              sa.status,
              a.public_id AS applicationId,
              a.name AS applicationName,
              c.enabled AS syncEnabled,
              c.interval_minutes AS intervalMinutes,
              c.last_synced_at AS lastSyncedAt,
              c.last_started_at AS lastStartedAt,
              c.last_error_at AS lastErrorAt,
              c.last_error_code AS lastErrorCode,
              c.last_error_message AS lastErrorMessage,
              t.status AS lastTaskStatus,
              t.finished_at AS lastTaskFinishedAt
         FROM store_apps sa
         JOIN applications a ON a.id = sa.application_id
         LEFT JOIN store_sync_configs c ON c.store_app_id = sa.id
         LEFT JOIN review_tasks t
           ON t.id = (SELECT t2.id FROM review_tasks t2 WHERE t2.store_app_id = sa.id ORDER BY t2.id DESC LIMIT 1)
        WHERE sa.workspace_id = ?${filterSql}
        ORDER BY a.name ASC, sa.store_type ASC`,
      params,
    );
    const now = Date.now();
    const items = rows.map((row) => {
      const lastSyncedAt = row.lastSyncedAt ? new Date(row.lastSyncedAt) : null;
      const intervalMinutes = Number(row.intervalMinutes ?? 15);
      const ageMinutes = lastSyncedAt ? (now - lastSyncedAt.getTime()) / 60_000 : null;
      let state: 'healthy' | 'delayed' | 'stale' | 'failing' | 'paused' | 'never';
      if (row.status !== 'active' || Number(row.syncEnabled ?? 0) === 0) {
        state = 'paused';
      } else if (row.lastTaskStatus === 'failed' || (row.lastErrorAt && (!lastSyncedAt || new Date(row.lastErrorAt) > lastSyncedAt))) {
        state = 'failing';
      } else if (ageMinutes === null) {
        state = 'never';
      } else if (ageMinutes <= intervalMinutes * 2) {
        state = 'healthy';
      } else if (ageMinutes <= 24 * 60) {
        state = 'delayed';
      } else {
        state = 'stale';
      }
      return {
        id: row.id,
        storeType: row.storeType,
        externalAppId: row.externalAppId,
        status: row.status,
        application: { id: row.applicationId, name: row.applicationName },
        syncEnabled: Number(row.syncEnabled ?? 0) === 1,
        intervalMinutes,
        lastSyncedAt,
        lastStartedAt: row.lastStartedAt,
        lastErrorAt: row.lastErrorAt,
        lastErrorCode: row.lastErrorCode,
        lastErrorMessage: row.lastErrorMessage,
        lastTaskStatus: row.lastTaskStatus,
        lastTaskFinishedAt: row.lastTaskFinishedAt,
        freshnessMinutes: ageMinutes === null ? null : Math.round(ageMinutes),
        state,
      };
    });
    return { asOf: new Date(), items };
  }

  private async resolveApplication(workspaceId: string, publicId?: string): Promise<string | null> {
    if (!publicId) return null;
    const application = await this.applications.findOne({ where: { workspaceId, publicId } });
    if (!application) {
      throw DomainException.notFound('APPLICATION_NOT_FOUND', 'Application not found');
    }
    return application.id;
  }

  private resolveRange(query: AnalyticsRangeQueryDto): Range {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw DomainException.badRequest('INVALID_DATE_RANGE', 'Invalid date range');
    }
    if (from > to) {
      throw DomainException.badRequest('INVALID_DATE_RANGE', 'from must be before to');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      throw DomainException.badRequest('DATE_RANGE_TOO_LARGE', `Range must be ${MAX_RANGE_DAYS} days or less`);
    }
    return { from, to };
  }
}
