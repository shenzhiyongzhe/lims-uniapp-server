export class RepaymentRecordResponseDto {
  id: number;
  loan_id: number;
  user_id: number;
  paid_amount: number;
  paid_at: Date;
  actual_collector_id?: number;
  actual_collector_name?: string;
  // 用户信息
  user_name?: string;
  // 贷款账户信息
  repaid_periods?: number;
  total_periods?: number;
}
