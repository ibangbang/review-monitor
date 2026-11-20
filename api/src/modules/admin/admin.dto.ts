import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { STORE_TYPES } from '../stores/stores.dto';
import type { StoreType } from '../../database/entities/store.entities';
import { REVIEW_STATUSES } from '../reviews/reviews.dto';
import type { InternalReviewStatus } from '../../database/entities/review.entities';
import {
  CHANNEL_TYPES,
  EVENT_TYPES,
  OUTBOX_STATUSES,
} from '../notifications/notifications.dto';
import type {
  ChannelType,
  NotificationEventType,
  OutboxStatus,
} from '../../database/entities/notification.entities';
import type { ReviewTaskStatus } from '../../database/entities/review.entities';
import type { UserStatus } from '../../database/entities/user.entities';
import type { WorkspaceStatus } from '../../database/entities/workspace.entities';

const TASK_STATUSES: ReviewTaskStatus[] = ['pending', 'running', 'succeeded', 'failed', 'cancelled'];
const USER_STATUSES: UserStatus[] = ['active', 'disabled', 'pending'];
const WORKSPACE_STATUSES: WorkspaceStatus[] = ['active', 'suspended', 'deleted'];

export class AdminLoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password!: string;
}

export class AdminKeywordQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;
}

export class AdminUserQueryDto extends AdminKeywordQueryDto {
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus;
}

export class AdminWorkspaceQueryDto extends AdminKeywordQueryDto {
  @IsOptional()
  @IsIn(WORKSPACE_STATUSES)
  status?: WorkspaceStatus;
}

export class AdminApplicationQueryDto extends AdminKeywordQueryDto {
  @IsOptional()
  @IsIn(STORE_TYPES)
  storeType?: StoreType;
}

export class AdminReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  applicationId?: string;

  @IsOptional()
  @IsIn(STORE_TYPES)
  storeType?: StoreType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: InternalReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  workspaceId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AdminTaskQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: ReviewTaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  workspaceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  storeAppId?: string;
}

export class AdminNotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(OUTBOX_STATUSES)
  status?: OutboxStatus;

  @IsOptional()
  @IsIn(EVENT_TYPES)
  eventType?: NotificationEventType;

  @IsOptional()
  @IsIn(CHANNEL_TYPES)
  channelType?: ChannelType;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  workspaceId?: string;
}

export class AdminAuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['admin', 'user', 'system'])
  actorType?: 'admin' | 'user' | 'system';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  resourceType?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
