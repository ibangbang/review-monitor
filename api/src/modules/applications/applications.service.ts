import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import { DomainException } from '../../common/errors/domain.exception';
import { newPublicId } from '../../common/utils/id';
import {
  Application,
  Review,
  StoreApp,
  StoreConnection,
  StoreSyncConfig,
} from '../../database/entities';
import type { StoreType } from '../../database/entities/store.entities';
import {
  ApplicationQueryDto,
  CreateApplicationDto,
  CreateStoreAppDto,
  StoreAppQueryDto,
  UpdateApplicationDto,
  UpdateStoreAppDto,
} from './applications.dto';

interface AppStats {
  storeAppCount: number;
  enabledStoreAppCount: number;
  lastSyncedAt: Date | null;
  reviewCount: number;
  newReviews7d: number;
  avgRating: number | null;
}

export interface PublicApplication {
  id: string;
  name: string;
  iconUrl: string | null;
  bundleId: string | null;
  packageName: string | null;
  description: string | null;
  status: 'active' | 'archived';
  storeAppCount: number;
  enabledStoreAppCount: number;
  lastSyncedAt: Date | null;
  reviewCount: number;
  newReviews7d: number;
  avgRating: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicStoreApp {
  id: string;
  applicationId: string;
  storeType: StoreType;
  externalAppId: string;
  countryCode: string;
  storeUrl: string | null;
  displayName: string | null;
  iconUrl: string | null;
  status: 'active' | 'paused' | 'disabled';
  connection: { id: string; name: string; status: string } | null;
  sync: {
    enabled: boolean;
    intervalMinutes: number;
    nextSyncAt: Date | null;
    lastStartedAt: Date | null;
    lastSyncedAt: Date | null;
    lastErrorAt: Date | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  } | null;
  reviewCount: number;
  lastReviewAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(StoreApp) private readonly storeApps: Repository<StoreApp>,
    @InjectRepository(StoreConnection) private readonly connections: Repository<StoreConnection>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
  ) {}

  async list(workspaceId: string, query: ApplicationQueryDto) {
    const qb = this.applications
      .createQueryBuilder('app')
      .where('app.workspace_id = :workspaceId', { workspaceId });
    if (query.status) qb.andWhere('app.status = :status', { status: query.status });
    if (query.keyword) {
      qb.andWhere(
        '(app.name LIKE :keyword OR app.bundle_id LIKE :keyword OR app.package_name LIKE :keyword)',
        { keyword: `%${query.keyword.trim()}%` },
      );
    }
    qb.orderBy('app.created_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    const [rows, total] = await qb.getManyAndCount();
    const stats = await this.statsFor(workspaceId, rows.map((row) => row.id));
    return paginated(
      rows.map((row) => this.toPublicApplication(row, stats.get(row.id))),
      total,
      query.page,
      query.pageSize,
    );
  }

  async create(workspaceId: string, dto: CreateApplicationDto): Promise<PublicApplication> {
    const application = this.applications.create({
      publicId: newPublicId(),
      workspaceId,
      name: dto.name.trim(),
      iconUrl: dto.iconUrl?.trim() || null,
      bundleId: dto.bundleId?.trim() || null,
      packageName: dto.packageName?.trim() || null,
      description: dto.description?.trim() || null,
      status: 'active',
    });
    await this.applications.save(application);
    return this.toPublicApplication(application, undefined);
  }

  async detail(workspaceId: string, publicId: string) {
    const application = await this.find(workspaceId, publicId);
    const storeApps = await this.storeApps.find({
      where: { applicationId: application.id },
      order: { createdAt: 'ASC' },
    });
    const stats = await this.statsFor(workspaceId, [application.id]);
    const [configs, connections, reviewStats] = await Promise.all([
      storeApps.length
        ? this.dataSource.getRepository(StoreSyncConfig).find({ where: storeApps.map((app) => ({ storeAppId: app.id })) })
        : Promise.resolve([]),
      storeApps.some((app) => app.storeConnectionId)
        ? this.connections
            .createQueryBuilder('connection')
            .where('connection.workspace_id = :workspaceId', { workspaceId })
            .andWhere('connection.id IN (:...connectionIds)', {
              connectionIds: storeApps
                .map((app) => app.storeConnectionId)
                .filter((id): id is string => Boolean(id)),
            })
            .getMany()
        : Promise.resolve([]),
      storeApps.length
        ? this.reviews
            .createQueryBuilder('r')
            .select('r.store_app_id', 'storeAppId')
            .addSelect('COUNT(*)', 'count')
            .addSelect('MAX(r.source_created_at)', 'lastReviewAt')
            .where('r.store_app_id IN (:...ids)', { ids: storeApps.map((app) => app.id) })
            .groupBy('r.store_app_id')
            .getRawMany<{ storeAppId: string; count: string; lastReviewAt: Date | null }>()
        : Promise.resolve([]),
    ]);

    const configByApp = new Map(configs.map((config) => [config.storeAppId, config]));
    const connectionById = new Map(connections.map((connection) => [connection.id, connection]));
    const reviewByApp = new Map(reviewStats.map((row) => [String(row.storeAppId), row]));

    return {
      ...this.toPublicApplication(application, stats.get(application.id)),
      storeApps: storeApps.map((storeApp) =>
        this.toPublicStoreApp(
          storeApp,
          configByApp.get(storeApp.id),
          storeApp.storeConnectionId ? connectionById.get(storeApp.storeConnectionId) : undefined,
          reviewByApp.get(storeApp.id),
        ),
      ),
    };
  }

  async update(
    workspaceId: string,
    publicId: string,
    dto: UpdateApplicationDto,
  ): Promise<PublicApplication> {
    const application = await this.find(workspaceId, publicId);
    if (dto.name !== undefined) application.name = dto.name.trim();
    if (dto.iconUrl !== undefined) application.iconUrl = dto.iconUrl?.trim() || null;
    if (dto.bundleId !== undefined) application.bundleId = dto.bundleId?.trim() || null;
    if (dto.packageName !== undefined) application.packageName = dto.packageName?.trim() || null;
    if (dto.description !== undefined) application.description = dto.description?.trim() || null;
    if (dto.status !== undefined) application.status = dto.status;
    await this.applications.save(application);

    if (dto.status === 'archived') {
      await this.pauseStoreApps(application.id);
    }
    const stats = await this.statsFor(workspaceId, [application.id]);
    return this.toPublicApplication(application, stats.get(application.id));
  }

  async archive(workspaceId: string, publicId: string): Promise<void> {
    const application = await this.find(workspaceId, publicId);
    await this.dataSource.transaction(async (manager) => {
      application.status = 'archived';
      await manager.save(application);
      const storeApps = await manager.find(StoreApp, { where: { applicationId: application.id } });
      for (const storeApp of storeApps) {
        storeApp.status = 'disabled';
        await manager.save(storeApp);
        await manager.update(
          StoreSyncConfig,
          { storeAppId: storeApp.id },
          { enabled: false, nextSyncAt: null },
        );
      }
    });
  }

  async listStoreApps(workspaceId: string, applicationPublicId: string, query: StoreAppQueryDto) {
    const application = await this.find(workspaceId, applicationPublicId);
    const where: Record<string, unknown> = { applicationId: application.id };
    if (query.storeType) where.storeType = query.storeType;
    if (query.status) where.status = query.status;

    const [rows, total] = await this.storeApps.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const items = await this.decorateStoreApps(workspaceId, rows);
    return paginated(items, total, query.page, query.pageSize);
  }

  async addStoreApp(
    workspaceId: string,
    applicationPublicId: string,
    dto: CreateStoreAppDto,
  ): Promise<PublicStoreApp> {
    const application = await this.find(workspaceId, applicationPublicId);

    let connection: StoreConnection | null = null;
    if (dto.storeConnectionId) {
      connection = await this.connections.findOne({
        where: { workspaceId, publicId: dto.storeConnectionId },
      });
      if (!connection) {
        throw DomainException.notFound('STORE_CONNECTION_NOT_FOUND', 'Store connection not found');
      }
      if (connection.storeType !== dto.storeType) {
        throw DomainException.badRequest(
          'STORE_TYPE_MISMATCH',
          `Connection is for ${connection.storeType}, not ${dto.storeType}`,
        );
      }
      if (connection.status !== 'active') {
        throw DomainException.unprocessable(
          'STORE_CONNECTION_NOT_ACTIVE',
          'Store connection must be active before binding an app',
        );
      }
    } else if (dto.storeType !== 'mock') {
      throw DomainException.badRequest(
        'STORE_CONNECTION_REQUIRED',
        'A store connection is required for this store type',
      );
    }

    const countryCode = (dto.countryCode ?? 'US').toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      throw DomainException.badRequest('INVALID_COUNTRY_CODE', 'countryCode must be a 2-letter code');
    }
    const externalAppId = dto.externalAppId.trim();

    const existing = await this.storeApps.findOne({
      where: {
        applicationId: application.id,
        storeType: dto.storeType,
        externalAppId,
        countryCode,
        storeConnectionId: connection ? connection.id : IsNull(),
      },
    });
    if (existing) {
      throw DomainException.conflict('STORE_APP_ALREADY_BOUND', 'This store app is already bound');
    }

    const storeApp = this.storeApps.create({
      publicId: newPublicId(),
      workspaceId,
      applicationId: application.id,
      storeConnectionId: connection?.id ?? null,
      storeType: dto.storeType,
      externalAppId,
      countryCode,
      storeUrl: dto.storeUrl?.trim() || null,
      displayName: dto.displayName?.trim() || null,
      iconUrl: dto.iconUrl?.trim() || null,
      status: 'active',
    });

    const enabled = dto.enabled !== false;
    const intervalMinutes = dto.intervalMinutes ?? 15;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(storeApp);
      await manager.save(
        manager.create(StoreSyncConfig, {
          workspaceId,
          storeAppId: storeApp.id,
          enabled,
          intervalMinutes,
          nextSyncAt: enabled ? new Date() : null,
        }),
      );
    });

    const items = await this.decorateStoreApps(workspaceId, [storeApp]);
    return items[0];
  }

  async updateStoreApp(
    workspaceId: string,
    storeAppPublicId: string,
    dto: UpdateStoreAppDto,
  ): Promise<PublicStoreApp> {
    const storeApp = await this.findStoreApp(workspaceId, storeAppPublicId);
    if (dto.countryCode !== undefined) storeApp.countryCode = dto.countryCode.toUpperCase();
    if (dto.storeUrl !== undefined) storeApp.storeUrl = dto.storeUrl?.trim() || null;
    if (dto.displayName !== undefined) storeApp.displayName = dto.displayName?.trim() || null;
    if (dto.iconUrl !== undefined) storeApp.iconUrl = dto.iconUrl?.trim() || null;
    if (dto.status !== undefined) storeApp.status = dto.status;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(storeApp);
      let config = await manager.findOne(StoreSyncConfig, { where: { storeAppId: storeApp.id } });
      if (!config) {
        config = manager.create(StoreSyncConfig, {
          workspaceId,
          storeAppId: storeApp.id,
          enabled: storeApp.status === 'active',
          intervalMinutes: dto.intervalMinutes ?? 15,
          nextSyncAt: storeApp.status === 'active' ? new Date() : null,
        });
      }
      if (dto.intervalMinutes !== undefined) config.intervalMinutes = dto.intervalMinutes;
      if (dto.enabled !== undefined) config.enabled = dto.enabled;
      if (storeApp.status !== 'active') config.enabled = false;
      if (!config.enabled) {
        config.nextSyncAt = null;
      } else if (!config.nextSyncAt) {
        config.nextSyncAt = new Date();
      }
      await manager.save(config);
    });

    const items = await this.decorateStoreApps(workspaceId, [storeApp]);
    return items[0];
  }

  async removeStoreApp(workspaceId: string, storeAppPublicId: string): Promise<void> {
    const storeApp = await this.findStoreApp(workspaceId, storeAppPublicId);
    await this.dataSource.transaction(async (manager) => {
      storeApp.status = 'disabled';
      await manager.save(storeApp);
      await manager.update(
        StoreSyncConfig,
        { storeAppId: storeApp.id },
        { enabled: false, nextSyncAt: null },
      );
    });
  }

  async find(workspaceId: string, publicId: string): Promise<Application> {
    const application = await this.applications.findOne({ where: { workspaceId, publicId } });
    if (!application) {
      throw DomainException.notFound('APPLICATION_NOT_FOUND', 'Application not found');
    }
    return application;
  }

  async findStoreApp(workspaceId: string, publicId: string): Promise<StoreApp> {
    const storeApp = await this.storeApps.findOne({ where: { workspaceId, publicId } });
    if (!storeApp) {
      throw DomainException.notFound('STORE_APP_NOT_FOUND', 'Store app binding not found');
    }
    return storeApp;
  }

  private async pauseStoreApps(applicationId: string): Promise<void> {
    const storeApps = await this.storeApps.find({ where: { applicationId } });
    for (const storeApp of storeApps) {
      storeApp.status = 'paused';
      await this.storeApps.save(storeApp);
      await this.dataSource
        .getRepository(StoreSyncConfig)
        .update({ storeAppId: storeApp.id }, { enabled: false, nextSyncAt: null });
    }
  }

  private async statsFor(workspaceId: string, appIds: string[]): Promise<Map<string, AppStats>> {
    const result = new Map<string, AppStats>();
    if (!appIds.length) return result;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [storeRows, syncRows, reviewRows] = await Promise.all([
      this.storeApps
        .createQueryBuilder('sa')
        .select('sa.application_id', 'applicationId')
        .addSelect('COUNT(*)', 'storeAppCount')
        .addSelect('SUM(CASE WHEN sa.status = :active THEN 1 ELSE 0 END)', 'enabledStoreAppCount')
        .where('sa.workspace_id = :workspaceId', { workspaceId })
        .andWhere('sa.application_id IN (:...appIds)', { appIds })
        .setParameter('active', 'active')
        .groupBy('sa.application_id')
        .getRawMany<{ applicationId: string; storeAppCount: string; enabledStoreAppCount: string }>(),
      this.dataSource
        .getRepository(StoreSyncConfig)
        .createQueryBuilder('sync')
        .leftJoin(StoreApp, 'sa', 'sa.id = sync.store_app_id')
        .select('sa.application_id', 'applicationId')
        .addSelect('MAX(sync.last_synced_at)', 'lastSyncedAt')
        .where('sync.workspace_id = :workspaceId', { workspaceId })
        .andWhere('sa.application_id IN (:...appIds)', { appIds })
        .groupBy('sa.application_id')
        .getRawMany<{ applicationId: string; lastSyncedAt: Date | null }>(),
      this.reviews
        .createQueryBuilder('r')
        .select('r.application_id', 'applicationId')
        .addSelect('COUNT(*)', 'reviewCount')
        .addSelect('SUM(CASE WHEN r.source_created_at >= :since THEN 1 ELSE 0 END)', 'newReviews7d')
        .addSelect('AVG(r.rating)', 'avgRating')
        .where('r.workspace_id = :workspaceId', { workspaceId })
        .andWhere('r.application_id IN (:...appIds)', { appIds })
        .setParameter('since', since)
        .groupBy('r.application_id')
        .getRawMany<{
          applicationId: string;
          reviewCount: string;
          newReviews7d: string;
          avgRating: string | null;
        }>(),
    ]);

    const storeMap = new Map(storeRows.map((row) => [String(row.applicationId), row]));
    const syncMap = new Map(syncRows.map((row) => [String(row.applicationId), row]));
    const reviewMap = new Map(reviewRows.map((row) => [String(row.applicationId), row]));

    for (const appId of appIds) {
      const store = storeMap.get(appId);
      const sync = syncMap.get(appId);
      const review = reviewMap.get(appId);
      result.set(appId, {
        storeAppCount: Number(store?.storeAppCount ?? 0),
        enabledStoreAppCount: Number(store?.enabledStoreAppCount ?? 0),
        lastSyncedAt: sync?.lastSyncedAt ?? null,
        reviewCount: Number(review?.reviewCount ?? 0),
        newReviews7d: Number(review?.newReviews7d ?? 0),
        avgRating: review?.avgRating == null ? null : Number(Number(review.avgRating).toFixed(2)),
      });
    }
    return result;
  }

  private async decorateStoreApps(workspaceId: string, rows: StoreApp[]): Promise<PublicStoreApp[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const [configs, connections, reviewRows] = await Promise.all([
      this.dataSource.getRepository(StoreSyncConfig).find({ where: ids.map((id) => ({ storeAppId: id })) }),
      this.connections.find({ where: { workspaceId } }),
      this.reviews
        .createQueryBuilder('r')
        .select('r.store_app_id', 'storeAppId')
        .addSelect('COUNT(*)', 'count')
        .addSelect('MAX(r.source_created_at)', 'lastReviewAt')
        .where('r.store_app_id IN (:...ids)', { ids })
        .groupBy('r.store_app_id')
        .getRawMany<{ storeAppId: string; count: string; lastReviewAt: Date | null }>(),
    ]);
    const configByApp = new Map(configs.map((config) => [config.storeAppId, config]));
    const connectionById = new Map(connections.map((connection) => [connection.id, connection]));
    const reviewByApp = new Map(reviewRows.map((row) => [String(row.storeAppId), row]));
    return rows.map((row) =>
      this.toPublicStoreApp(
        row,
        configByApp.get(row.id),
        row.storeConnectionId ? connectionById.get(row.storeConnectionId) : undefined,
        reviewByApp.get(row.id),
      ),
    );
  }

  private toPublicApplication(application: Application, stats?: AppStats): PublicApplication {
    return {
      id: application.publicId,
      name: application.name,
      iconUrl: application.iconUrl,
      bundleId: application.bundleId,
      packageName: application.packageName,
      description: application.description,
      status: application.status,
      storeAppCount: stats?.storeAppCount ?? 0,
      enabledStoreAppCount: stats?.enabledStoreAppCount ?? 0,
      lastSyncedAt: stats?.lastSyncedAt ?? null,
      reviewCount: stats?.reviewCount ?? 0,
      newReviews7d: stats?.newReviews7d ?? 0,
      avgRating: stats?.avgRating ?? null,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }

  private toPublicStoreApp(
    storeApp: StoreApp,
    config: StoreSyncConfig | undefined,
    connection: StoreConnection | undefined,
    review?: { count: string; lastReviewAt: Date | null },
  ): PublicStoreApp {
    return {
      id: storeApp.publicId,
      applicationId: storeApp.applicationId,
      storeType: storeApp.storeType,
      externalAppId: storeApp.externalAppId,
      countryCode: storeApp.countryCode,
      storeUrl: storeApp.storeUrl,
      displayName: storeApp.displayName,
      iconUrl: storeApp.iconUrl,
      status: storeApp.status,
      connection: connection
        ? { id: connection.publicId, name: connection.name, status: connection.status }
        : null,
      sync: config
        ? {
            enabled: config.enabled,
            intervalMinutes: config.intervalMinutes,
            nextSyncAt: config.nextSyncAt,
            lastStartedAt: config.lastStartedAt,
            lastSyncedAt: config.lastSyncedAt,
            lastErrorAt: config.lastErrorAt,
            lastErrorCode: config.lastErrorCode,
            lastErrorMessage: config.lastErrorMessage,
          }
        : null,
      reviewCount: Number(review?.count ?? 0),
      lastReviewAt: review?.lastReviewAt ?? null,
      createdAt: storeApp.createdAt,
      updatedAt: storeApp.updatedAt,
    };
  }
}
