import { IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CollectorSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  adminId?: number;

  @IsOptional()
  @IsString()
  targetDate?: string;
}
