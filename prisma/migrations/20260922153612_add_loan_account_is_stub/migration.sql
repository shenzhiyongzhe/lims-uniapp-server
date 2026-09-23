-- AlterTable
ALTER TABLE "archives" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "loan_accounts" ADD COLUMN     "is_stub" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "loan_accounts_is_stub_idx" ON "loan_accounts"("is_stub");

-- CreateIndex
CREATE INDEX "loan_accounts_is_stub_status_idx" ON "loan_accounts"("is_stub", "status");
