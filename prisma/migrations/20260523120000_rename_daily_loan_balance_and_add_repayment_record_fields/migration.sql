-- RenameTable
ALTER TABLE "collector_daily_loan_balance" RENAME TO "daily_loan_balance";

-- RenameColumns
ALTER TABLE "daily_loan_balance" RENAME COLUMN "yesterday_loan_total" TO "today_loan_total";
ALTER TABLE "daily_loan_balance" RENAME COLUMN "yesterday_loan_items" TO "today_loan_items";

-- RenameConstraints
ALTER TABLE "daily_loan_balance" RENAME CONSTRAINT "collector_daily_loan_balance_pkey" TO "daily_loan_balance_pkey";
ALTER TABLE "daily_loan_balance" RENAME CONSTRAINT "collector_daily_loan_balance_admin_id_fkey" TO "daily_loan_balance_admin_id_fkey";

-- RenameIndexes
ALTER INDEX "collector_daily_loan_balance_date_idx" RENAME TO "daily_loan_balance_date_idx";
ALTER INDEX "collector_daily_loan_balance_admin_id_idx" RENAME TO "daily_loan_balance_admin_id_idx";
ALTER INDEX "collector_daily_loan_balance_admin_id_date_key" RENAME TO "daily_loan_balance_admin_id_date_key";

-- AddColumnsToRepaymentRecords
ALTER TABLE "repayment_records" ADD COLUMN "due_date" DATE;
ALTER TABLE "repayment_records" ADD COLUMN "is_overdue_repaid" BOOLEAN NOT NULL DEFAULT false;
