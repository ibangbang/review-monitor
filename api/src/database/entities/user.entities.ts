import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserStatus = 'active' | 'disabled' | 'pending';

@Entity('users')
export class User {
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
  status!: UserStatus;

  @Column({ type: 'datetime', nullable: true })
  emailVerifiedAt!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('user_sessions')
@Index(['userId'])
export class UserSession {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  userId!: string;

  @Column({ type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ type: 'datetime' })
  expiresAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'char', length: 64, nullable: true })
  replacedByTokenHash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
