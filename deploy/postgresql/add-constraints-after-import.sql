-- Indexes + foreign keys from prisma/migrations/20260521120000_init_postgresql/migration.sql
-- Use when tables/data were imported without Prisma constraints (Navicat / pgloader DDL, etc.).
--
-- 1) psql ... -f deploy/postgresql/check-orphan-fks.sql   (must return no orphan rows)
-- 2) psql ... -f deploy/postgresql/add-constraints-after-import.sql
-- 3) npm run db:reset-sequences
-- 4) npx prisma migrate resolve --applied 20260521120000_init_postgresql   (if _prisma_migrations missing)

-- ========== UNIQUE / INDEX (skip if already exists) ==========

CREATE UNIQUE INDEX IF NOT EXISTS "admins_openid_key" ON "admins"("openid");

CREATE INDEX IF NOT EXISTS "loan_accounts_collector_id_idx" ON "loan_accounts"("collector_id");
CREATE INDEX IF NOT EXISTS "loan_accounts_risk_controller_id_idx" ON "loan_accounts"("risk_controller_id");
CREATE INDEX IF NOT EXISTS "loan_accounts_user_id_idx" ON "loan_accounts"("user_id");

CREATE INDEX IF NOT EXISTS "loan_account_roles_admin_id_idx" ON "loan_account_roles"("admin_id");
CREATE INDEX IF NOT EXISTS "loan_account_roles_loan_account_id_idx" ON "loan_account_roles"("loan_account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "loan_account_roles_loan_account_id_admin_id_role_type_key" ON "loan_account_roles"("loan_account_id", "admin_id", "role_type");

CREATE INDEX IF NOT EXISTS "repayment_schedules_loan_id_idx" ON "repayment_schedules"("loan_id");

CREATE INDEX IF NOT EXISTS "repayment_schedule_operation_logs_schedule_id_idx" ON "repayment_schedule_operation_logs"("schedule_id");
CREATE INDEX IF NOT EXISTS "repayment_schedule_operation_logs_loan_id_idx" ON "repayment_schedule_operation_logs"("loan_id");
CREATE INDEX IF NOT EXISTS "repayment_schedule_operation_logs_operator_admin_id_idx" ON "repayment_schedule_operation_logs"("operator_admin_id");

CREATE INDEX IF NOT EXISTS "repayment_records_actual_collector_id_idx" ON "repayment_records"("actual_collector_id");
CREATE INDEX IF NOT EXISTS "repayment_records_loan_id_idx" ON "repayment_records"("loan_id");
CREATE INDEX IF NOT EXISTS "repayment_records_repayment_schedule_id_idx" ON "repayment_records"("repayment_schedule_id");
CREATE INDEX IF NOT EXISTS "repayment_records_user_id_idx" ON "repayment_records"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "overdue_records_schedule_id_key" ON "overdue_records"("schedule_id");
CREATE INDEX IF NOT EXISTS "overdue_records_collector_overdue_date_idx" ON "overdue_records"("collector", "overdue_date");
CREATE INDEX IF NOT EXISTS "overdue_records_overdue_date_idx" ON "overdue_records"("overdue_date");
CREATE INDEX IF NOT EXISTS "overdue_records_user_id_overdue_date_idx" ON "overdue_records"("user_id", "overdue_date");

CREATE INDEX IF NOT EXISTS "daily_statistics_date_idx" ON "daily_statistics"("date");
CREATE INDEX IF NOT EXISTS "daily_statistics_admin_id_idx" ON "daily_statistics"("admin_id");
CREATE UNIQUE INDEX IF NOT EXISTS "daily_statistics_admin_id_date_role_key" ON "daily_statistics"("admin_id", "date", "role");

CREATE INDEX IF NOT EXISTS "collector_daily_loan_balance_date_idx" ON "collector_daily_loan_balance"("date");
CREATE INDEX IF NOT EXISTS "collector_daily_loan_balance_admin_id_idx" ON "collector_daily_loan_balance"("admin_id");
CREATE UNIQUE INDEX IF NOT EXISTS "collector_daily_loan_balance_admin_id_date_key" ON "collector_daily_loan_balance"("admin_id", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "collector_asset_management_admin_id_key" ON "collector_asset_management"("admin_id");
CREATE UNIQUE INDEX IF NOT EXISTS "risk_controller_asset_management_admin_id_key" ON "risk_controller_asset_management"("admin_id");

CREATE INDEX IF NOT EXISTS "loan_field_predictions_field_name_frequency_idx" ON "loan_field_predictions"("field_name", "frequency");
CREATE INDEX IF NOT EXISTS "loan_field_predictions_field_name_value_idx" ON "loan_field_predictions"("field_name", "value");
CREATE UNIQUE INDEX IF NOT EXISTS "loan_field_predictions_field_name_value_key" ON "loan_field_predictions"("field_name", "value");

CREATE INDEX IF NOT EXISTS "asset_reduction_history_admin_id_idx" ON "asset_reduction_history"("admin_id");

-- ========== FOREIGN KEYS ==========

ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_risk_controller_id_fkey" FOREIGN KEY ("risk_controller_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loan_account_roles" ADD CONSTRAINT "loan_account_roles_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_account_roles" ADD CONSTRAINT "loan_account_roles_loan_account_id_fkey" FOREIGN KEY ("loan_account_id") REFERENCES "loan_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repayment_schedule_operation_logs" ADD CONSTRAINT "repayment_schedule_operation_logs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "repayment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repayment_schedule_operation_logs" ADD CONSTRAINT "repayment_schedule_operation_logs_operator_admin_id_fkey" FOREIGN KEY ("operator_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "repayment_records" ADD CONSTRAINT "repayment_records_actual_collector_id_fkey" FOREIGN KEY ("actual_collector_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "repayment_records" ADD CONSTRAINT "repayment_records_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "repayment_records" ADD CONSTRAINT "repayment_records_repayment_schedule_id_fkey" FOREIGN KEY ("repayment_schedule_id") REFERENCES "repayment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "repayment_records" ADD CONSTRAINT "repayment_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "overdue_records" ADD CONSTRAINT "overdue_records_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "repayment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_statistics" ADD CONSTRAINT "daily_statistics_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "collector_daily_loan_balance" ADD CONSTRAINT "collector_daily_loan_balance_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collector_asset_management" ADD CONSTRAINT "collector_asset_management_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "risk_controller_asset_management" ADD CONSTRAINT "risk_controller_asset_management_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_reduction_history" ADD CONSTRAINT "asset_reduction_history_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
