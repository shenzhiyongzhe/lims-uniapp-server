/*
  Warnings:

  - You are about to drop the `loan_account_roles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "loan_account_roles" DROP CONSTRAINT "loan_account_roles_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "loan_account_roles" DROP CONSTRAINT "loan_account_roles_loan_account_id_fkey";

-- DropTable
DROP TABLE "loan_account_roles";
