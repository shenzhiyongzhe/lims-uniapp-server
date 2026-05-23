import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { LoanAccountStatus } from '@prisma/client';

export class UpdateLoanAccountStatusDto {
  @IsEnum(LoanAccountStatus)
  status: LoanAccountStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  settlement_capital?: number;

  @IsDateString()
  @IsOptional()
  settlement_date?: string;
}
