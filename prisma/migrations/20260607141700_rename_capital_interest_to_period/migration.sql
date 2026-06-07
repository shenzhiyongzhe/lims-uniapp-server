-- Rename columns in loan_accounts
ALTER TABLE "loan_accounts" RENAME COLUMN "capital" TO "period_capital";
ALTER TABLE "loan_accounts" RENAME COLUMN "interest" TO "period_interest";

-- Rename columns in deleted_loans
ALTER TABLE "deleted_loans" RENAME COLUMN "capital" TO "period_capital";
ALTER TABLE "deleted_loans" RENAME COLUMN "interest" TO "period_interest";
