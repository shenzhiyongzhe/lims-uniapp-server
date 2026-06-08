import { IsEnum, IsInt, IsOptional, IsString, NotEquals } from 'class-validator';
import { ReductionType } from '@prisma/client';

export class CreateReductionRecordDto {
  /** 目标负责人 ID */
  @IsInt()
  collector_id: number;

  /** 减资类型：罚金 / 手续费 / 本金 */
  @IsEnum(ReductionType)
  reduction_type: ReductionType;

  /** 本次减资金额（非零整数），正数表示减少，负数表示增加 */
  @IsInt()
  @NotEquals(0)
  amount: number;

  /** 备注 */
  @IsString()
  @IsOptional()
  remark?: string;
}
