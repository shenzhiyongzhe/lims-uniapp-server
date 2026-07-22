-- CreateTable
CREATE TABLE "staff_configs" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "staff_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_configs_staff_id_idx" ON "staff_configs"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_configs_staff_id_key_key" ON "staff_configs"("staff_id", "key");

-- AddForeignKey
ALTER TABLE "staff_configs" ADD CONSTRAINT "staff_configs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
