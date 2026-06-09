import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ReductionType } from '@prisma/client';

export enum ReductionPerspective {
  collector = 'collector',
  risk_controller = 'risk_controller',
}

/** 查询减资关联人员汇总（下拉列表） */
export class QueryReductionCounterpartySummaryDto {
  @IsEnum(ReductionPerspective)
  perspective!: ReductionPerspective;

  @Type(() => Number)
  @IsNumber()
  adminId!: number;

  @IsOptional()
  @IsEnum(ReductionType)
  reductionType?: ReductionType;
}
