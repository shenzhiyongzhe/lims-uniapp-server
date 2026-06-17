import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminAdjustDto {
  @IsNumber()
  delta: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}
