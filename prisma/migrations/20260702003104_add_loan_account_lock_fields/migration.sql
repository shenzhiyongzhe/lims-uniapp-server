-- AlterTable
ALTER TABLE "loan_accounts" ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "locked_by" INTEGER;

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
