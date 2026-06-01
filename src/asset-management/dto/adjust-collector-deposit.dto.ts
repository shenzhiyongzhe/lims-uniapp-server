import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdjustCollectorDepositDto {
  @IsNumber()
  delta: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}
