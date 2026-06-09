import { IsString, Matches } from 'class-validator';

/** 查询存出款按日汇总 */
export class QueryDepositDailySummaryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month 必须为 YYYY-MM 格式' })
  month!: string;
}
