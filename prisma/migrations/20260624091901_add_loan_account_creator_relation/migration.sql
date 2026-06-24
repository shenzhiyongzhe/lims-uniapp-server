-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
