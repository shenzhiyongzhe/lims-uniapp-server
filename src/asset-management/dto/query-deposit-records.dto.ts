import { IsNumber, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

/** 查询存出款明细 */
export class QueryDepositRecordsDto {
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
