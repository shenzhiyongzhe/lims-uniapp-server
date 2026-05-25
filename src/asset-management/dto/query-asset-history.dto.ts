import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAssetHistoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  adminId?: number;

  @IsOptional()
  @IsIn(['collector', 'risk_controller'])
  assetType?: 'collector' | 'risk_controller';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
