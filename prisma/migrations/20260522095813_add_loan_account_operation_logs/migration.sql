-- CreateTable
CREATE TABLE "loan_account_operation_logs" (
    "id" SERIAL NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "operator_admin_id" INTEGER,
    "operator_admin_name" VARCHAR(50),
    "action_type" VARCHAR(50) NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_account_operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_account_operation_logs_loan_id_idx" ON "loan_account_operation_logs"("loan_id");

-- CreateIndex
CREATE INDEX "loan_account_operation_logs_operator_admin_id_idx" ON "loan_account_operation_logs"("operator_admin_id");

-- AddForeignKey
ALTER TABLE "loan_account_operation_logs" ADD CONSTRAINT "loan_account_operation_logs_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_account_operation_logs" ADD CONSTRAINT "loan_account_operation_logs_operator_admin_id_fkey" FOREIGN KEY ("operator_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
