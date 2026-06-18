import { IsEnum, IsNumber, IsOptional, IsString, Matches } from 'class-validator';
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

  /** 业务日筛选（可选，YYYY-MM-DD） */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 必须为 YYYY-MM-DD 格式' })
  date?: string;
}
