/*
  Warnings:

  - You are about to alter the column `old_value` on the `asset_reduction_history` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `input_value` on the `asset_reduction_history` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `new_value` on the `asset_reduction_history` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `total_handling_fee` on the `collector_asset_management` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `total_fines` on the `collector_asset_management` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `reduced_fines` on the `collector_asset_management` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `reduced_handling_fee` on the `collector_asset_management` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `deposit` on the `collector_asset_management` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `reduced_by_risk_controller` on the `collector_asset_management` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `previous_total` on the `daily_loan_balance` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Integer`.
  - You are about to alter the column `today_loan_total` on the `daily_loan_balance` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Integer`.
  - You are about to alter the column `today_repaid_total` on the `daily_loan_balance` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Integer`.
  - You are about to alter the column `today_total` on the `daily_loan_balance` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Integer`.
  - You are about to alter the column `loan_amount` on the `deleted_loans` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `period_capital` on the `deleted_loans` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `period_interest` on the `deleted_loans` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `loan_amount` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `receiving_amount` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `to_hand_ratio` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `period_capital` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `period_interest` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `handling_fee` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_capital` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `total_fines` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_interest` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `early_settlement_capital` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `last_edit_fines` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `last_edit_pay_capital` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `last_edit_pay_interest` on the `loan_accounts` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_amount` on the `repayment_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_capital` on the `repayment_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_fines` on the `repayment_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_interest` on the `repayment_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_capital_before` on the `repayment_schedule_operation_logs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_interest_before` on the `repayment_schedule_operation_logs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `fines_before` on the `repayment_schedule_operation_logs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_capital_after` on the `repayment_schedule_operation_logs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_interest_after` on the `repayment_schedule_operation_logs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `fines_after` on the `repayment_schedule_operation_logs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `due_amount` on the `repayment_schedules` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `capital` on the `repayment_schedules` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `interest` on the `repayment_schedules` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_amount` on the `repayment_schedules` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `fines` on the `repayment_schedules` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_capital` on the `repayment_schedules` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `paid_interest` on the `repayment_schedules` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `total_amount` on the `risk_controller_asset_management` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to alter the column `reduced_amount` on the `risk_controller_asset_management` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "asset_reduction_history" ALTER COLUMN "old_value" SET DATA TYPE INTEGER,
ALTER COLUMN "input_value" SET DATA TYPE INTEGER,
ALTER COLUMN "new_value" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "collector_asset_management" ALTER COLUMN "total_handling_fee" SET DEFAULT 0,
ALTER COLUMN "total_handling_fee" SET DATA TYPE INTEGER,
ALTER COLUMN "total_fines" SET DEFAULT 0,
ALTER COLUMN "total_fines" SET DATA TYPE INTEGER,
ALTER COLUMN "reduced_fines" SET DEFAULT 0,
ALTER COLUMN "reduced_fines" SET DATA TYPE INTEGER,
ALTER COLUMN "reduced_handling_fee" SET DEFAULT 0,
ALTER COLUMN "reduced_handling_fee" SET DATA TYPE INTEGER,
ALTER COLUMN "deposit" SET DEFAULT 0,
ALTER COLUMN "deposit" SET DATA TYPE INTEGER,
ALTER COLUMN "reduced_by_risk_controller" SET DEFAULT 0,
ALTER COLUMN "reduced_by_risk_controller" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "daily_loan_balance" ALTER COLUMN "previous_total" SET DEFAULT 0,
ALTER COLUMN "previous_total" SET DATA TYPE INTEGER,
ALTER COLUMN "today_loan_total" SET DEFAULT 0,
ALTER COLUMN "today_loan_total" SET DATA TYPE INTEGER,
ALTER COLUMN "today_repaid_total" SET DEFAULT 0,
ALTER COLUMN "today_repaid_total" SET DATA TYPE INTEGER,
ALTER COLUMN "today_total" SET DEFAULT 0,
ALTER COLUMN "today_total" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "deleted_loans" ALTER COLUMN "loan_amount" SET DATA TYPE INTEGER,
ALTER COLUMN "period_capital" SET DATA TYPE INTEGER,
ALTER COLUMN "period_interest" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "loan_accounts" ALTER COLUMN "loan_amount" SET DATA TYPE INTEGER,
ALTER COLUMN "receiving_amount" SET DATA TYPE INTEGER,
ALTER COLUMN "to_hand_ratio" SET DATA TYPE INTEGER,
ALTER COLUMN "period_capital" SET DATA TYPE INTEGER,
ALTER COLUMN "period_interest" SET DATA TYPE INTEGER,
ALTER COLUMN "handling_fee" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_capital" SET DEFAULT 0,
ALTER COLUMN "paid_capital" SET DATA TYPE INTEGER,
ALTER COLUMN "total_fines" SET DEFAULT 0,
ALTER COLUMN "total_fines" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_interest" SET DEFAULT 0,
ALTER COLUMN "paid_interest" SET DATA TYPE INTEGER,
ALTER COLUMN "early_settlement_capital" SET DATA TYPE INTEGER,
ALTER COLUMN "last_edit_fines" SET DATA TYPE INTEGER,
ALTER COLUMN "last_edit_pay_capital" SET DATA TYPE INTEGER,
ALTER COLUMN "last_edit_pay_interest" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "repayment_records" ALTER COLUMN "paid_amount" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_capital" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_fines" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_interest" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "repayment_schedule_operation_logs" ALTER COLUMN "paid_capital_before" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_interest_before" SET DATA TYPE INTEGER,
ALTER COLUMN "fines_before" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_capital_after" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_interest_after" SET DATA TYPE INTEGER,
ALTER COLUMN "fines_after" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "repayment_schedules" ALTER COLUMN "due_amount" SET DATA TYPE INTEGER,
ALTER COLUMN "capital" SET DATA TYPE INTEGER,
ALTER COLUMN "interest" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_amount" SET DATA TYPE INTEGER,
ALTER COLUMN "fines" SET DEFAULT 0,
ALTER COLUMN "fines" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_capital" SET DEFAULT 0,
ALTER COLUMN "paid_capital" SET DATA TYPE INTEGER,
ALTER COLUMN "paid_interest" SET DEFAULT 0,
ALTER COLUMN "paid_interest" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "risk_controller_asset_management" ALTER COLUMN "total_amount" SET DEFAULT 0,
ALTER COLUMN "total_amount" SET DATA TYPE INTEGER,
ALTER COLUMN "reduced_amount" SET DEFAULT 0,
ALTER COLUMN "reduced_amount" SET DATA TYPE INTEGER;
