import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AdminStatus = 'active' | 'disabled';

@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: AdminStatus;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('admin_sessions')
@Index(['adminUserId'])
export class AdminSession {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  adminUserId!: string;

  @Column({ type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ type: 'datetime' })
  expiresAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}

@Entity('audit_logs')
@Index(['actorType', 'createdAt'])
@Index(['resourceType', 'resourceId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint', nullable: true })
  adminUserId!: string | null;

  @Column({ type: 'bigint', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  actorType!: 'admin' | 'user' | 'system';

  @Column({ type: 'varchar', length: 120 })
  action!: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  resourceType!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'json', nullable: true })
  beforeSummary!: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  afterSummary!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
