import { IsBoolean } from 'class-validator';

export class UpdateLoanAccountLockDto {
  @IsBoolean()
  is_locked: boolean;
}
