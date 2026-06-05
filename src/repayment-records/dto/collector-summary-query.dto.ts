import { IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CollectorSummaryQueryDto {
  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  collectorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  riskControllerId?: number;
}
