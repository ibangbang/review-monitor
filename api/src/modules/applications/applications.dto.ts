import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { STORE_TYPES } from '../stores/stores.dto';
import type { StoreType } from '../../database/entities/store.entities';

export class ApplicationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;
}

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bundleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  packageName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bundleId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  packageName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}

export class StoreAppQueryDto extends PaginationQueryDto {
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
  @IsInt()
  @Min(5)
  @Max(1440)
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
  @IsInt()
  @Min(5)
  @Max(1440)
  intervalMinutes?: number;
}
