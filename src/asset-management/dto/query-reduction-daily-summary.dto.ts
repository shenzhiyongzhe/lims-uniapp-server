import { IsNumber, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

/** 查询减资按日汇总 */
export class QueryReductionDailySummaryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month 必须为 YYYY-MM 格式' })
  month!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  riskControllerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  collectorId?: number;
}
