import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WorkspaceStatus = 'active' | 'suspended' | 'deleted';
export type WorkspaceRole = 'owner' | 'admin' | 'member';

@Entity('workspaces')
@Index(['ownerUserId'])
export class Workspace {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'char', length: 26, unique: true })
  publicId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'bigint' })
  ownerUserId!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: WorkspaceStatus;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

@Entity('workspace_members')
@Index(['workspaceId', 'userId'], { unique: true })
@Index(['userId'])
export class WorkspaceMember {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  workspaceId!: string;

  @Column({ type: 'bigint' })
  userId!: string;

  @Column({ type: 'varchar', length: 20, default: 'owner' })
  role!: WorkspaceRole;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'disabled';

  @Column({ type: 'datetime' })
  joinedAt!: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
