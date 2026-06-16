import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class TransferCollectorDepositDto {
  /** 划账金额必须是正整数 */
  @IsInt()
  @Min(1, { message: '划账金额必须是大于0的整数' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}
