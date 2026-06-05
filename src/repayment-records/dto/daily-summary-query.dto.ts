import { IsOptional, IsNumber, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class DailySummaryQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month 必须为 YYYY-MM 格式' })
  month!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  collectorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  riskControllerId?: number;
}
