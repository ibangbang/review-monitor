import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type {
  ChannelType,
  NotificationEventType,
  OutboxStatus,
} from '../../database/entities/notification.entities';

export const CHANNEL_TYPES: ChannelType[] = ['telegram', 'webhook'];
export const EVENT_TYPES: NotificationEventType[] = [
  'review.created',
  'review.updated',
  'sync.failed',
  'auth.invalid',
];
export const OUTBOX_STATUSES: OutboxStatus[] = ['pending', 'running', 'sent', 'failed', 'cancelled'];

export class ChannelQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(CHANNEL_TYPES)
  channelType?: ChannelType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class CreateChannelDto {
  @IsIn(CHANNEL_TYPES)
  channelType!: ChannelType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class RuleQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(EVENT_TYPES)
  eventType?: NotificationEventType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsIn(EVENT_TYPES)
  eventType!: NotificationEventType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  maxRating?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicationIds?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelIds?: string[] | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(EVENT_TYPES)
  eventType?: NotificationEventType;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  maxRating?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicationIds?: string[] | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelIds?: string[] | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class NotificationHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(OUTBOX_STATUSES)
  status?: OutboxStatus;

  @IsOptional()
  @IsIn(EVENT_TYPES)
  eventType?: NotificationEventType;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  channelId?: string;
}
