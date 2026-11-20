import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CredentialCryptoService } from '../../common/crypto/credential-crypto.service';
import { paginated } from '../../common/dto/pagination.dto';
import { DomainException } from '../../common/errors/domain.exception';
import { newPublicId } from '../../common/utils/id';
import {
  StoreApp,
  StoreConnection,
  StoreSyncConfig,
} from '../../database/entities';
import type { StoreType } from '../../database/entities/store.entities';
import { StoreAdapterRegistry } from './adapters/adapter.registry';
import { STORE_LABELS, StoreAdapter, ValidationResult } from './adapters/store-adapter.types';
import {
  CreateStoreConnectionDto,
  StoreConnectionQueryDto,
  UpdateStoreConnectionDto,
} from './stores.dto';

export interface PublicStoreConnection {
  id: string;
  storeType: StoreType;
  name: string;
  status: 'active' | 'invalid' | 'disabled';
  credentialFingerprint: string;
  credentialConfigured: boolean;
  lastValidatedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  boundAppCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class StoreConnectionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: CredentialCryptoService,
    private readonly adapters: StoreAdapterRegistry,
    @InjectRepository(StoreConnection) private readonly connections: Repository<StoreConnection>,
    @InjectRepository(StoreApp) private readonly storeApps: Repository<StoreApp>,
  ) {}

  async list(workspaceId: string, query: StoreConnectionQueryDto) {
    const where: Record<string, unknown> = { workspaceId };
    if (query.storeType) where.storeType = query.storeType;
    if (query.status) where.status = query.status;

    const [rows, total] = await this.connections.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    const counts = await this.boundAppCounts(workspaceId);
    return paginated(
      rows.map((row) => this.toPublic(row, counts.get(row.id) ?? 0)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async create(workspaceId: string, dto: CreateStoreConnectionDto): Promise<PublicStoreConnection> {
    const adapter = this.requireAdapter(dto.storeType);
    this.assertCredentialShape(adapter, dto.credentials);

    const connection = this.connections.create({
      publicId: newPublicId(),
      workspaceId,
      storeType: dto.storeType,
      name: dto.name?.trim() || STORE_LABELS[dto.storeType],
      credentialCiphertext: this.crypto.encrypt(JSON.stringify(dto.credentials)),
      credentialKeyVersion: this.crypto.keyVersion,
      credentialFingerprint: this.crypto.fingerprint(dto.credentials),
      status: 'active',
    });
    await this.connections.save(connection);
    return this.toPublic(connection, 0);
  }

  async update(
    workspaceId: string,
    publicId: string,
    dto: UpdateStoreConnectionDto,
  ): Promise<PublicStoreConnection> {
    const connection = await this.find(workspaceId, publicId);
    const adapter = this.requireAdapter(connection.storeType);

    if (dto.name !== undefined) connection.name = dto.name.trim();
    if (dto.enabled !== undefined) {
      connection.status = dto.enabled ? 'active' : 'disabled';
      if (dto.enabled) {
        connection.lastErrorCode = null;
        connection.lastErrorMessage = null;
      }
    }
    if (dto.credentials) {
      const current = JSON.parse(this.crypto.decrypt(connection.credentialCiphertext)) as Record<string, unknown>;
      const merged = { ...current, ...dto.credentials };
      this.assertCredentialShape(adapter, merged);
      connection.credentialCiphertext = this.crypto.encrypt(JSON.stringify(merged));
      connection.credentialKeyVersion = this.crypto.keyVersion;
      connection.credentialFingerprint = this.crypto.fingerprint(merged);
      connection.status = dto.enabled === false ? 'disabled' : 'active';
      connection.lastErrorCode = null;
      connection.lastErrorMessage = null;
    }
    await this.connections.save(connection);
    const counts = await this.boundAppCounts(workspaceId);
    return this.toPublic(connection, counts.get(connection.id) ?? 0);
  }

  async remove(workspaceId: string, publicId: string): Promise<void> {
    const connection = await this.find(workspaceId, publicId);
    await this.dataSource.transaction(async (manager) => {
      const apps = await manager.find(StoreApp, { where: { storeConnectionId: connection.id } });
      for (const app of apps) {
        app.storeConnectionId = null;
        app.status = 'paused';
        await manager.save(app);
        await manager.update(StoreSyncConfig, { storeAppId: app.id }, { enabled: false, nextSyncAt: null });
      }
      await manager.delete(StoreConnection, connection.id);
    });
  }

  async validate(workspaceId: string, publicId: string): Promise<ValidationResult & { connection: PublicStoreConnection }> {
    const connection = await this.find(workspaceId, publicId);
    const adapter = this.requireAdapter(connection.storeType);
    const credentials = JSON.parse(this.crypto.decrypt(connection.credentialCiphertext)) as Record<string, unknown>;

    let result: ValidationResult;
    try {
      result = await adapter.validateConnection(credentials);
    } catch (error) {
      result = {
        valid: false,
        code: 'STORE_VALIDATION_FAILED',
        message: error instanceof Error ? error.message.slice(0, 300) : 'Validation failed',
      };
    }

    connection.lastValidatedAt = new Date();
    if (result.valid) {
      connection.status = 'active';
      connection.lastErrorCode = null;
      connection.lastErrorMessage = null;
    } else if (connection.status !== 'disabled') {
      connection.status = 'invalid';
      connection.lastErrorCode = result.code ?? 'STORE_VALIDATION_FAILED';
      connection.lastErrorMessage = (result.message ?? 'Store authorization is not valid').slice(0, 500);
    }
    await this.connections.save(connection);
    const counts = await this.boundAppCounts(workspaceId);
    return { ...result, connection: this.toPublic(connection, counts.get(connection.id) ?? 0) };
  }

  async find(workspaceId: string, publicId: string): Promise<StoreConnection> {
    const connection = await this.connections.findOne({ where: { workspaceId, publicId } });
    if (!connection) {
      throw DomainException.notFound('STORE_CONNECTION_NOT_FOUND', 'Store connection not found');
    }
    return connection;
  }

  private requireAdapter(storeType: StoreType): StoreAdapter {
    const adapter = this.adapters.get(storeType);
    if (!adapter) {
      throw DomainException.badRequest(
        'STORE_NOT_SUPPORTED',
        `${storeType} does not have an official adapter yet. Supported: apple, google, huawei, mock.`,
      );
    }
    return adapter;
  }

  private assertCredentialShape(adapter: StoreAdapter, credentials: Record<string, unknown>): void {
    const missing = adapter.validateCredentialShape(credentials);
    if (missing.length) {
      throw DomainException.badRequest(
        'CREDENTIAL_FIELDS_MISSING',
        `Missing required credential fields: ${missing.join(', ')}`,
      );
    }
  }

  private async boundAppCounts(workspaceId: string): Promise<Map<string, number>> {
    const rows = await this.storeApps
      .createQueryBuilder('sa')
      .select('sa.store_connection_id', 'connectionId')
      .addSelect('COUNT(*)', 'count')
      .where('sa.workspace_id = :workspaceId', { workspaceId })
      .andWhere('sa.store_connection_id IS NOT NULL')
      .groupBy('sa.store_connection_id')
      .getRawMany<{ connectionId: string; count: string }>();
    return new Map(rows.map((row) => [String(row.connectionId), Number(row.count)]));
  }

  private toPublic(connection: StoreConnection, boundAppCount: number): PublicStoreConnection {
    return {
      id: connection.publicId,
      storeType: connection.storeType,
      name: connection.name,
      status: connection.status,
      credentialFingerprint: connection.credentialFingerprint.slice(0, 12),
      credentialConfigured: Boolean(connection.credentialCiphertext),
      lastValidatedAt: connection.lastValidatedAt,
      lastErrorCode: connection.lastErrorCode,
      lastErrorMessage: connection.lastErrorMessage,
      boundAppCount,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }
}
