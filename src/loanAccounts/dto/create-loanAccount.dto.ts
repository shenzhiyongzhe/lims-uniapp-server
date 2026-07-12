import {
  IsDateString,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
  Max,
  Length,
  IsPositive,
} from 'class-validator';
import { RepaymentScheduleStatus } from '@prisma/client';

export class CreateLoanAccountDto {
  @IsNumber()
  @IsPositive()
  user_id: number;

  @IsNumber()
  @Min(0)
  @Max(1000000)
  loan_amount: number;

  @IsNumber()
  @IsPositive()
  @Max(1000000)
  to_hand_ratio: number;

  @IsNumber()
  @Min(0)
  period_capital: number;

  @IsNumber()
  @Min(0)
  period_interest: number;

  @IsDateString()
  due_start_date: string;

  @IsDateString()
  due_end_date: string;

  @IsEnum(RepaymentScheduleStatus)
  @IsOptional()
  status?: RepaymentScheduleStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  handling_fee?: number;

  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(365)
  total_periods: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  repaid_periods?: number;

  @IsNumber()
  @IsPositive()
  daily_repayment: number;

  @IsNumber()
  @IsPositive()
  risk_controller_id: number;

  @IsNumber()
  @IsPositive()
  collector_id: number;

  @IsNumber()
  @IsOptional()
  receiving_amount?: number;

  @IsNumber()
  @IsOptional()
  company_cost?: number;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  @Length(0, 5)
  ownership?: string;

  @IsString()
  @IsOptional()
  @Length(0, 100)
  payer_name?: string;
}
