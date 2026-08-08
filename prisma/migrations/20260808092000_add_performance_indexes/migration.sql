-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loan_accounts_status_due_start_date_due_end_date_idx" ON "loan_accounts"("status", "due_start_date", "due_end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loan_accounts_due_start_date_status_idx" ON "loan_accounts"("due_start_date", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loan_accounts_status_created_at_idx" ON "loan_accounts"("status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "repayment_schedules_due_start_date_status_loan_id_idx" ON "repayment_schedules"("due_start_date", "status", "loan_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "repayment_schedules_status_due_start_date_idx" ON "repayment_schedules"("status", "due_start_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "repayment_schedules_loan_id_status_period_idx" ON "repayment_schedules"("loan_id", "status", "period");
