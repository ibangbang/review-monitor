import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyticsRangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(26)
  applicationId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class TrendQueryDto extends AnalyticsRangeQueryDto {
  @IsOptional()
  @IsIn(['day', 'week'])
  granularity?: 'day' | 'week';
}

export class DistributionQueryDto extends AnalyticsRangeQueryDto {}
export class ComparisonQueryDto extends AnalyticsRangeQueryDto {}
export class SyncHealthQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(26)
  applicationId?: string;
}
