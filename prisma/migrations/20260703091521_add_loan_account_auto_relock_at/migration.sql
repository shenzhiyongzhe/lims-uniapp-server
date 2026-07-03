-- AlterTable
ALTER TABLE "loan_accounts" ADD COLUMN     "auto_relock_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "loan_accounts_auto_relock_at_idx" ON "loan_accounts"("auto_relock_at");
