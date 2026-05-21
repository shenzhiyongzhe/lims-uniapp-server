-- CreateEnum
CREATE TYPE "ManagementRoles" AS ENUM ('ADMIN', 'RISK_CONTROLLER', 'COLLECTOR', 'PENDING');

-- CreateEnum
CREATE TYPE "LoanAccountStatus" AS ENUM ('pending', 'active', 'overdue', 'settled', 'unsettled', 'negotiated', 'to_be_processed', 'blacklist');

-- CreateEnum
CREATE TYPE "RepaymentScheduleStatus" AS ENUM ('pending', 'active', 'overdue', 'paid', 'terminated');

-- CreateEnum
CREATE TYPE "RepaymentScheduleOperationType" AS ENUM ('collect', 'edit');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(10) NOT NULL,
    "overtime" INTEGER DEFAULT 0,
    "overdue_time" INTEGER DEFAULT 0,
    "is_high_risk" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(10),
    "role" "ManagementRoles" NOT NULL,
    "openid" VARCHAR(100),
    "nickname" VARCHAR(100),
    "avatar_url" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(45),
    "token_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "loan_amount" DECIMAL(10,2) NOT NULL,
    "receiving_amount" DECIMAL(10,2),
    "to_hand_ratio" DECIMAL(10,2),
    "capital" DECIMAL(10,2) NOT NULL,
    "interest" DECIMAL(10,2) NOT NULL,
    "due_start_date" DATE NOT NULL,
    "due_end_date" DATE NOT NULL,
    "status" "LoanAccountStatus" NOT NULL DEFAULT 'pending',
    "handling_fee" DECIMAL(10,2) NOT NULL,
    "total_periods" INTEGER NOT NULL,
    "repaid_periods" INTEGER NOT NULL DEFAULT 0,
    "daily_repayment" INTEGER NOT NULL DEFAULT 0,
    "company_cost" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3),
    "collector_id" INTEGER NOT NULL,
    "risk_controller_id" INTEGER NOT NULL,
    "apply_times" INTEGER NOT NULL DEFAULT 0,
    "paid_capital" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "status_changed_at" TIMESTAMP(3),
    "total_fines" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "paid_interest" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "early_settlement_capital" DECIMAL(10,2),
    "last_edit_fines" DECIMAL(10,2),
    "last_edit_pay_capital" DECIMAL(10,2),
    "last_edit_pay_interest" DECIMAL(10,2),
    "note" VARCHAR(300),
    "overdue_count" INTEGER NOT NULL DEFAULT 0,
    "ownership" VARCHAR(5),
    "payer_name" VARCHAR(100),

    CONSTRAINT "loan_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_account_roles" (
    "id" SERIAL NOT NULL,
    "loan_account_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "role_type" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_account_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayment_schedules" (
    "id" SERIAL NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "due_start_date" DATE NOT NULL,
    "due_amount" DECIMAL(10,2) NOT NULL,
    "capital" DECIMAL(10,2),
    "interest" DECIMAL(10,2),
    "status" "RepaymentScheduleStatus" NOT NULL DEFAULT 'pending',
    "paid_amount" DECIMAL(10,2),
    "paid_at" TIMESTAMP(3),
    "fines" DECIMAL(10,2) DEFAULT 0.00,
    "operator_admin_id" INTEGER,
    "operator_admin_name" VARCHAR(50),
    "paid_capital" DECIMAL(10,2) DEFAULT 0.00,
    "paid_interest" DECIMAL(10,2) DEFAULT 0.00,

    CONSTRAINT "repayment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayment_schedule_operation_logs" (
    "id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "action_type" "RepaymentScheduleOperationType" NOT NULL,
    "operator_admin_id" INTEGER,
    "operator_admin_name" VARCHAR(50),
    "paid_capital_before" DECIMAL(10,2),
    "paid_interest_before" DECIMAL(10,2),
    "fines_before" DECIMAL(10,2),
    "paid_capital_after" DECIMAL(10,2),
    "paid_interest_after" DECIMAL(10,2),
    "fines_after" DECIMAL(10,2),
    "remark" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repayment_schedule_operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayment_records" (
    "id" SERIAL NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "paid_amount" DECIMAL(10,2),
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_capital" DECIMAL(10,2),
    "paid_fines" DECIMAL(10,2),
    "paid_interest" DECIMAL(10,2),
    "repayment_schedule_id" INTEGER,
    "actual_collector_id" INTEGER,
    "remark" VARCHAR(10),

    CONSTRAINT "repayment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overdue_records" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "collector" VARCHAR(10) NOT NULL,
    "overdue_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overdue_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_statistics" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "admin_name" VARCHAR(10) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "total_fines" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_handling_fee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "active_count" INTEGER NOT NULL DEFAULT 0,
    "last_month_blacklist_count" INTEGER NOT NULL DEFAULT 0,
    "last_month_fines" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "last_month_handling_fee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "this_month_blacklist_count" INTEGER NOT NULL DEFAULT 0,
    "this_month_fines" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "this_month_handling_fee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "this_month_negotiated_count" INTEGER NOT NULL DEFAULT 0,
    "this_month_new_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "this_month_settled_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "today_blacklist_count" INTEGER NOT NULL DEFAULT 0,
    "today_collection" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "today_fines" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "today_handling_fee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "today_negotiated_count" INTEGER NOT NULL DEFAULT 0,
    "today_new_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "today_paid_count" INTEGER NOT NULL DEFAULT 0,
    "today_pending_count" INTEGER NOT NULL DEFAULT 0,
    "today_settled_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "today_unpaid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_blacklist_count" INTEGER NOT NULL DEFAULT 0,
    "total_in_stock_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_in_stock_count" INTEGER NOT NULL DEFAULT 0,
    "total_negotiated_count" INTEGER NOT NULL DEFAULT 0,
    "total_received_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "yesterday_collection" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "yesterday_overdue_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_daily_loan_balance" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "previous_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "yesterday_loan_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "today_repaid_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "today_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "yesterday_loan_items" JSONB,
    "today_repaid_items" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collector_daily_loan_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_asset_management" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "total_handling_fee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total_fines" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reduced_fines" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "reduced_handling_fee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "collector_asset_management_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_controller_asset_management" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "reduced_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_controller_asset_management_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_field_predictions" (
    "id" SERIAL NOT NULL,
    "field_name" VARCHAR(50) NOT NULL,
    "value" VARCHAR(50) NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_field_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_reduction_history" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "asset_type" VARCHAR(50) NOT NULL,
    "field_name" VARCHAR(50) NOT NULL,
    "old_value" DECIMAL(10,2) NOT NULL,
    "input_value" DECIMAL(10,2) NOT NULL,
    "new_value" DECIMAL(10,2) NOT NULL,
    "updated_by_admin_id" INTEGER,
    "updated_by_admin_username" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_reduction_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changelogs" (
    "id" SERIAL NOT NULL,
    "released_at" DATE NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "changelogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_openid_key" ON "admins"("openid");

-- CreateIndex
CREATE INDEX "loan_accounts_collector_id_idx" ON "loan_accounts"("collector_id");

-- CreateIndex
CREATE INDEX "loan_accounts_risk_controller_id_idx" ON "loan_accounts"("risk_controller_id");

-- CreateIndex
CREATE INDEX "loan_accounts_user_id_idx" ON "loan_accounts"("user_id");

-- CreateIndex
CREATE INDEX "loan_account_roles_admin_id_idx" ON "loan_account_roles"("admin_id");

-- CreateIndex
CREATE INDEX "loan_account_roles_loan_account_id_idx" ON "loan_account_roles"("loan_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_account_roles_loan_account_id_admin_id_role_type_key" ON "loan_account_roles"("loan_account_id", "admin_id", "role_type");

-- CreateIndex
CREATE INDEX "repayment_schedules_loan_id_idx" ON "repayment_schedules"("loan_id");

-- CreateIndex
CREATE INDEX "repayment_schedule_operation_logs_schedule_id_idx" ON "repayment_schedule_operation_logs"("schedule_id");

-- CreateIndex
CREATE INDEX "repayment_schedule_operation_logs_loan_id_idx" ON "repayment_schedule_operation_logs"("loan_id");

-- CreateIndex
CREATE INDEX "repayment_schedule_operation_logs_operator_admin_id_idx" ON "repayment_schedule_operation_logs"("operator_admin_id");

-- CreateIndex
CREATE INDEX "repayment_records_actual_collector_id_idx" ON "repayment_records"("actual_collector_id");

-- CreateIndex
CREATE INDEX "repayment_records_loan_id_idx" ON "repayment_records"("loan_id");

-- CreateIndex
CREATE INDEX "repayment_records_repayment_schedule_id_idx" ON "repayment_records"("repayment_schedule_id");

-- CreateIndex
CREATE INDEX "repayment_records_user_id_idx" ON "repayment_records"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "overdue_records_schedule_id_key" ON "overdue_records"("schedule_id");

-- CreateIndex
CREATE INDEX "overdue_records_collector_overdue_date_idx" ON "overdue_records"("collector", "overdue_date");

-- CreateIndex
CREATE INDEX "overdue_records_overdue_date_idx" ON "overdue_records"("overdue_date");

-- CreateIndex
CREATE INDEX "overdue_records_user_id_overdue_date_idx" ON "overdue_records"("user_id", "overdue_date");

-- CreateIndex
CREATE INDEX "daily_statistics_date_idx" ON "daily_statistics"("date");

-- CreateIndex
CREATE INDEX "daily_statistics_admin_id_idx" ON "daily_statistics"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_statistics_admin_id_date_role_key" ON "daily_statistics"("admin_id", "date", "role");

-- CreateIndex
CREATE INDEX "collector_daily_loan_balance_date_idx" ON "collector_daily_loan_balance"("date");

-- CreateIndex
CREATE INDEX "collector_daily_loan_balance_admin_id_idx" ON "collector_daily_loan_balance"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "collector_daily_loan_balance_admin_id_date_key" ON "collector_daily_loan_balance"("admin_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "collector_asset_management_admin_id_key" ON "collector_asset_management"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_controller_asset_management_admin_id_key" ON "risk_controller_asset_management"("admin_id");

-- CreateIndex
CREATE INDEX "loan_field_predictions_field_name_frequency_idx" ON "loan_field_predictions"("field_name", "frequency");

-- CreateIndex
CREATE INDEX "loan_field_predictions_field_name_value_idx" ON "loan_field_predictions"("field_name", "value");

-- CreateIndex
CREATE UNIQUE INDEX "loan_field_predictions_field_name_value_key" ON "loan_field_predictions"("field_name", "value");

-- CreateIndex
CREATE INDEX "asset_reduction_history_admin_id_idx" ON "asset_reduction_history"("admin_id");

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_risk_controller_id_fkey" FOREIGN KEY ("risk_controller_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_account_roles" ADD CONSTRAINT "loan_account_roles_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_account_roles" ADD CONSTRAINT "loan_account_roles_loan_account_id_fkey" FOREIGN KEY ("loan_account_id") REFERENCES "loan_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_schedule_operation_logs" ADD CONSTRAINT "repayment_schedule_operation_logs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "repayment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_schedule_operation_logs" ADD CONSTRAINT "repayment_schedule_operation_logs_operator_admin_id_fkey" FOREIGN KEY ("operator_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_records" ADD CONSTRAINT "repayment_records_actual_collector_id_fkey" FOREIGN KEY ("actual_collector_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_records" ADD CONSTRAINT "repayment_records_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_records" ADD CONSTRAINT "repayment_records_repayment_schedule_id_fkey" FOREIGN KEY ("repayment_schedule_id") REFERENCES "repayment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_records" ADD CONSTRAINT "repayment_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overdue_records" ADD CONSTRAINT "overdue_records_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "repayment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_statistics" ADD CONSTRAINT "daily_statistics_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_daily_loan_balance" ADD CONSTRAINT "collector_daily_loan_balance_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_asset_management" ADD CONSTRAINT "collector_asset_management_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_controller_asset_management" ADD CONSTRAINT "risk_controller_asset_management_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_reduction_history" ADD CONSTRAINT "asset_reduction_history_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

