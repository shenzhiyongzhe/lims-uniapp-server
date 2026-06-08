-- CreateEnum
CREATE TYPE "ReductionType" AS ENUM ('fines', 'handling_fee', 'amount');

-- AlterTable
ALTER TABLE "collector_asset_management" DROP COLUMN "reduced_by_risk_controller",
DROP COLUMN "reduced_fines",
DROP COLUMN "reduced_handling_fee";

-- AlterTable
ALTER TABLE "risk_controller_asset_management" DROP COLUMN "reduced_amount";

-- CreateTable
CREATE TABLE "risk_controller_reduction_records" (
    "id" SERIAL NOT NULL,
    "risk_controller_id" INTEGER NOT NULL,
    "collector_id" INTEGER NOT NULL,
    "reduction_type" "ReductionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "remark" VARCHAR(200),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_controller_reduction_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_controller_reduction_records_risk_controller_id_idx" ON "risk_controller_reduction_records"("risk_controller_id");

-- CreateIndex
CREATE INDEX "risk_controller_reduction_records_collector_id_idx" ON "risk_controller_reduction_records"("collector_id");

-- CreateIndex
CREATE INDEX "risk_controller_reduction_records_risk_controller_id_collec_idx" ON "risk_controller_reduction_records"("risk_controller_id", "collector_id");

-- CreateIndex
CREATE INDEX "risk_controller_reduction_records_created_at_idx" ON "risk_controller_reduction_records"("created_at");

-- AddForeignKey
ALTER TABLE "risk_controller_reduction_records" ADD CONSTRAINT "risk_controller_reduction_records_risk_controller_id_fkey" FOREIGN KEY ("risk_controller_id") REFERENCES "staffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_controller_reduction_records" ADD CONSTRAINT "risk_controller_reduction_records_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "staffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_controller_reduction_records" ADD CONSTRAINT "risk_controller_reduction_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
