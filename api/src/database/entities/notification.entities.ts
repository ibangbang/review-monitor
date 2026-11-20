import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ChannelType = 'telegram' | 'webhook';
export type OutboxStatus = 'pending' | 'running' | 'sent' | 'failed' | 'cancelled';
export type NotificationEventType = 'review.created' | 'review.updated' | 'sync.failed' | 'auth.invalid';

@Entity('notification_channels')
@Index(['workspaceId', 'channelType'])
export class NotificationChannel {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'varchar', length: 20 })
  channelType!: ChannelType;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text' })
  configCiphertext!: string;

  @Column({ type: 'int', default: 1 })
  configKeyVersion!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastTestedAt!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('notification_rules')
@Index(['workspaceId', 'enabled'])
export class NotificationRule {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 30, default: 'review.created' })
  eventType!: NotificationEventType;

  @Column({ type: 'tinyint', nullable: true })
  minRating!: number | null;

  @Column({ type: 'tinyint', nullable: true })
  maxRating!: number | null;

  @Column({ type: 'json', nullable: true })
  applicationIds!: string[] | null;

  @Column({ type: 'json', nullable: true })
  channelIds!: string[] | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('notification_outbox')
@Index(['workspaceId', 'dedupeKey', 'channelId'], { unique: true })
@Index(['status', 'nextRetryAt'])
@Index(['status', 'lockedUntil'])
export class NotificationOutbox {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'bigint' })
  channelId!: string;

  @Column({ type: 'varchar', length: 30 })
  eventType!: NotificationEventType;

  @Column({ type: 'varchar', length: 191 })
  dedupeKey!: string;

  @Column({ type: 'json' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'int', default: 5 })
  maxAttempts!: number;

  @Column({ type: 'datetime', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lockedUntil!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('notification_attempts')
@Index(['outboxId', 'attemptNo'], { unique: true })
export class NotificationAttempt {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  outboxId!: string;

  @Column({ type: 'int' })
  attemptNo!: number;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ type: 'datetime' })
  startedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
