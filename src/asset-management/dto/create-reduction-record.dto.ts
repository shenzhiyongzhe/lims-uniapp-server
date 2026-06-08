import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ReductionType } from '@prisma/client';

export class CreateReductionRecordDto {
  /** 目标负责人 ID */
  @IsInt()
  collector_id: number;

  /** 减资类型：罚金 / 手续费 / 本金 */
  @IsEnum(ReductionType)
  reduction_type: ReductionType;

  /** 本次减资金额（正整数） */
  @IsInt()
  @Min(1)
  amount: number;

  /** 备注 */
  @IsString()
  @IsOptional()
  remark?: string;
}
