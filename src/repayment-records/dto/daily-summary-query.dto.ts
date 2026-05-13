import { IsOptional, IsNumber, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class DailySummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  payeeId?: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month 必须为 YYYY-MM 格式' })
  month!: string;
}
