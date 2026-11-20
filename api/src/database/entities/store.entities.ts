import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StoreType = 'apple' | 'google' | 'huawei' | 'xiaomi' | 'oppo' | 'vivo' | 'mock';
export type ConnectionStatus = 'active' | 'invalid' | 'disabled';
export type StoreAppStatus = 'active' | 'paused' | 'disabled';

@Entity('store_connections')
@Index(['workspaceId', 'storeType', 'status'])
export class StoreConnection {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'varchar', length: 20 })
  storeType!: StoreType;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'longtext' })
  credentialCiphertext!: string;

  @Column({ type: 'int', default: 1 })
  credentialKeyVersion!: number;

  @Column({ type: 'char', length: 64 })
  credentialFingerprint!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: ConnectionStatus;

  @Column({ type: 'datetime', nullable: true })
  lastValidatedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lastErrorCode!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  lastErrorMessage!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('applications')
@Index(['workspaceId', 'status'])
export class Application {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  iconUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bundleId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  packageName!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'archived';

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('store_apps')
@Index(['workspaceId', 'applicationId'])
@Index(['workspaceId', 'storeType'])
@Index(['storeType', 'storeConnectionId', 'externalAppId', 'countryCode'], { unique: true })
export class StoreApp {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'bigint' })
  applicationId!: string;

  @Column({ type: 'bigint', nullable: true })
  storeConnectionId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  storeType!: StoreType;

  @Column({ type: 'varchar', length: 255 })
  externalAppId!: string;

  @Column({ type: 'char', length: 2, default: 'US' })
  countryCode!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  storeUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  iconUrl!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: StoreAppStatus;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('store_sync_configs')
@Index(['storeAppId'], { unique: true })
@Index(['enabled', 'nextSyncAt'])
@Index(['workspaceId', 'enabled'])
export class StoreSyncConfig {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'bigint' })
  storeAppId!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'int', default: 15 })
  intervalMinutes!: number;

  @Column({ type: 'datetime', nullable: true })
  nextSyncAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastStartedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastErrorAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lastErrorCode!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  lastErrorMessage!: string | null;

  @Column({ type: 'text', nullable: true })
  cursor!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
