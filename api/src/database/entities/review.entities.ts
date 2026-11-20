import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type InternalReviewStatus = 'unprocessed' | 'processing' | 'resolved' | 'ignored';
export type ReviewTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

@Entity('reviews')
@Index(['storeAppId', 'externalReviewId'], { unique: true })
@Index(['workspaceId', 'sourceCreatedAt'])
@Index(['workspaceId', 'internalStatus', 'sourceCreatedAt'])
@Index(['workspaceId', 'rating', 'sourceCreatedAt'])
@Index(['workspaceId', 'applicationId', 'sourceCreatedAt'])
@Index(['storeAppId', 'sourceCreatedAt'])
export class Review {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'bigint' })
  applicationId!: string;

  @Column({ type: 'bigint' })
  storeAppId!: string;

  @Column({ type: 'varchar', length: 20 })
  storeType!: string;

  @Column({ type: 'varchar', length: 255 })
  externalReviewId!: string;

  @Column({ type: 'tinyint' })
  rating!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  authorName!: string | null;

  @Column({ type: 'char', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  languageCode!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  appVersion!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  device!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  osVersion!: string | null;

  @Column({ type: 'datetime' })
  sourceCreatedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  sourceUpdatedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  developerReply!: string | null;

  @Column({ type: 'datetime', nullable: true })
  developerReplyAt!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'unprocessed' })
  internalStatus!: InternalReviewStatus;

  @Column({ type: 'json', nullable: true })
  rawData!: unknown | null;

  @Column({ type: 'datetime' })
  firstSeenAt!: Date;

  @Column({ type: 'datetime' })
  lastSyncedAt!: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

export type ReviewEventType =
  | 'created'
  | 'updated'
  | 'rating_changed'
  | 'reply_updated'
  | 'status_changed';

@Entity('review_events')
@Index(['workspaceId', 'reviewId', 'createdAt'])
export class ReviewEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'bigint' })
  reviewId!: string;

  @Column({ type: 'varchar', length: 30 })
  eventType!: ReviewEventType;

  @Column({ type: 'json', nullable: true })
  oldValues!: unknown | null;

  @Column({ type: 'json', nullable: true })
  newValues!: unknown | null;

  @Column({ type: 'varchar', length: 30, default: 'worker' })
  source!: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}

@Entity('review_notes')
@Index(['workspaceId', 'reviewId', 'createdAt'])
export class ReviewNote {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'bigint' })
  reviewId!: string;

  @Column({ type: 'bigint' })
  userId!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('review_tasks')
@Index(['status', 'scheduledAt'])
@Index(['status', 'nextRetryAt'])
@Index(['status', 'lockedUntil'])
@Index(['workspaceId', 'createdAt'])
@Index(['storeAppId', 'createdAt'])
export class ReviewTask {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'bigint' })
  storeAppId!: string;

  @Column({ type: 'varchar', length: 30, default: 'sync_reviews' })
  taskType!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ReviewTaskStatus;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'int', default: 5 })
  maxAttempts!: number;

  @Column({ type: 'datetime' })
  scheduledAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lockedUntil!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  workerRequestId!: string | null;

  @Column({ type: 'int', default: 0 })
  fetchedCount!: number;

  @Column({ type: 'int', default: 0 })
  insertedCount!: number;

  @Column({ type: 'int', default: 0 })
  updatedCount!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('review_task_attempts')
@Index(['taskId', 'attemptNo'], { unique: true })
export class ReviewTaskAttempt {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  taskId!: string;

  @Column({ type: 'int' })
  attemptNo!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  functionRequestId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ type: 'datetime' })
  startedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'int', default: 0 })
  fetchedCount!: number;

  @Column({ type: 'int', default: 0 })
  insertedCount!: number;

  @Column({ type: 'int', default: 0 })
  updatedCount!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
