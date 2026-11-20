import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { StoreType } from '../../database/entities/store.entities';
export const STORE_TYPES: StoreType[] = ['apple', 'google', 'huawei', 'xiaomi', 'oppo', 'vivo', 'mock'];

export class StoreConnectionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(STORE_TYPES)
  storeType?: StoreType;

  @IsOptional()
  @IsIn(['active', 'invalid', 'disabled'])
  status?: 'active' | 'invalid' | 'disabled';
}

export class CreateStoreConnectionDto {
  @IsIn(STORE_TYPES)
  storeType!: StoreType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsObject()
  credentials!: Record<string, unknown>;
}

export class UpdateStoreConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class StoreConnectionIdParamDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}

export class ApplicationScopedStoreAppQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(STORE_TYPES)
  storeType?: StoreType;

  @IsOptional()
  @IsIn(['active', 'paused', 'disabled'])
  status?: 'active' | 'paused' | 'disabled';
}

export class CreateStoreAppDto {
  @IsIn(STORE_TYPES)
  storeType!: StoreType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  externalAppId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(26)
  storeConnectionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsIn([5, 10, 15, 30, 60])
  intervalMinutes?: number;
}

export class UpdateStoreAppDto {
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storeUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string | null;

  @IsOptional()
  @IsIn(['active', 'paused', 'disabled'])
  status?: 'active' | 'paused' | 'disabled';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsIn([5, 10, 15, 30, 60])
  intervalMinutes?: number;
}
