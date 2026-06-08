import { IsNumber, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

/** 查询减资明细记录 */
export class QueryReductionRecordsDto {
  /** 风控人 ID（可选） */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  riskControllerId?: number;

  /** 负责人 ID（可选） */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  collectorId?: number;

  /** 类型过滤（可选） */
  @IsOptional()
  reductionType?: string;

  /** 业务日筛选（可选，YYYY-MM-DD） */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 必须为 YYYY-MM-DD 格式' })
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;
}
