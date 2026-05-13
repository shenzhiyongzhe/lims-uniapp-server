export declare class RepaymentRecordResponseDto {
    id: number;
    loan_id: number;
    user_id: number;
    paid_amount: number;
    paid_at: Date;
    actual_collector_id?: number;
    actual_collector_name?: string;
    user_name?: string;
    repaid_periods?: number;
    total_periods?: number;
    remark?: string;
}
