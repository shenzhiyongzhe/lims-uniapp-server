import { IsNumber, IsOptional } from 'class-validator';
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;
}
