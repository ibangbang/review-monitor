import { Type } from 'class-transformer';
import {
  IsDateString,
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
import type { InternalReviewStatus } from '../../database/entities/review.entities';

export const REVIEW_STATUSES: InternalReviewStatus[] = [
  'unprocessed',
  'processing',
  'resolved',
  'ignored',
];

export const REVIEW_SORTS = [
  'newest',
  'oldest',
  'rating_desc',
  'rating_asc',
  'updated',
] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export class ReviewQueryDto extends PaginationQueryDto {
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
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(REVIEW_SORTS)
  sort?: ReviewSort;
}

export class UpdateReviewStatusDto {
  @IsIn(REVIEW_STATUSES)
  status!: InternalReviewStatus;
}

export class CreateReviewNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}
