-- CreateTable
CREATE TABLE "deleted_loans" (
    "id" SERIAL NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "loan_amount" DECIMAL(10,2) NOT NULL,
    "capital" DECIMAL(10,2) NOT NULL,
    "interest" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "total_periods" INTEGER NOT NULL,
    "repaid_periods" INTEGER NOT NULL,
    "due_start_date" DATE NOT NULL,
    "due_end_date" DATE NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_by" INTEGER,
    "data" JSONB NOT NULL,

    CONSTRAINT "deleted_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deleted_loans_loan_id_key" ON "deleted_loans"("loan_id");
