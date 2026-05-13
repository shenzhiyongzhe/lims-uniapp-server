"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepaymentScheduleResponseDto = exports.LoanAccountInfo = exports.UserInfo = void 0;
class UserInfo {
    id;
    username;
    overtime;
    overdue_time;
    is_high_risk;
}
exports.UserInfo = UserInfo;
class LoanAccountInfo {
    id;
    user_id;
    loan_amount;
    capital;
    interest;
    due_start_date;
    due_end_date;
    status;
    handling_fee;
    total_periods;
    repaid_periods;
    daily_repayment;
    risk_controller;
    collector;
    lender;
    user;
}
exports.LoanAccountInfo = LoanAccountInfo;
class RepaymentScheduleResponseDto {
    id;
    loan_id;
    period;
    due_start_date;
    due_amount;
    capital;
    interest;
    remaining_capital;
    remaining_interest;
    fines;
    status;
    paid_amount;
    paid_at;
    loan_account;
}
exports.RepaymentScheduleResponseDto = RepaymentScheduleResponseDto;
//# sourceMappingURL=repayment-schedule-response.dto.js.map