-- CreateTable
CREATE TABLE "admin_adjustment" (
    "id" SERIAL NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_adjustment_history" (
    "id" SERIAL NOT NULL,
    "delta" INTEGER NOT NULL,
    "old_total" INTEGER NOT NULL,
    "new_total" INTEGER NOT NULL,
    "updated_by_admin_id" INTEGER,
    "updated_by_admin_username" VARCHAR(50),
    "remark" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_adjustment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_adjustment_history_created_at_idx" ON "admin_adjustment_history"("created_at");
