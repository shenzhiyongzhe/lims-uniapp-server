import { LoanAccountStatus } from '@prisma/client';
export declare class UpdateLoanAccountDto {
    loan_amount?: number;
    to_hand_ratio?: number;
    capital?: number;
    interest?: number;
    due_start_date?: string;
    due_end_date?: string;
    status?: LoanAccountStatus;
    handling_fee?: number;
    total_periods?: number;
    repaid_periods?: number;
    daily_repayment?: number;
    risk_controller_id?: number;
    collector_id?: number;
    receiving_amount?: number;
    company_cost?: number;
    apply_times?: number;
    note?: string;
    ownership?: string;
    payer_name?: string;
}
