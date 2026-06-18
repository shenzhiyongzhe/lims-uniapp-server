-- Historical reduction records without a collector cannot be associated with a
-- specific counterparty after collector_id becomes required.
DELETE FROM "risk_controller_reduction_records"
WHERE "collector_id" IS NULL;

-- DropForeignKey
ALTER TABLE "risk_controller_reduction_records" DROP CONSTRAINT "risk_controller_reduction_records_collector_id_fkey";

-- AlterTable
ALTER TABLE "risk_controller_reduction_records" ALTER COLUMN "collector_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "risk_controller_reduction_records" ADD CONSTRAINT "risk_controller_reduction_records_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "staffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
