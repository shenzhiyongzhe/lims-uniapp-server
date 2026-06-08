import { IsNumber, IsOptional } from 'class-validator';

/** 仅用于调整 collector 存款（deposit），旧的 reduced_* 字段已移除 */
export class UpdateCollectorAssetDto {
  @IsNumber()
  @IsOptional()
  deposit?: number;
}
