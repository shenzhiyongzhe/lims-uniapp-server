import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PinLoanDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  loanId!: number;
}
