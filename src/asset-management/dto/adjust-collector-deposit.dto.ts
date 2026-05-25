import { IsNumber } from 'class-validator';

export class AdjustCollectorDepositDto {
  @IsNumber()
  delta: number;
}
