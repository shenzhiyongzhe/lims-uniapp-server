-- DropForeignKey
ALTER TABLE "risk_controller_reduction_records" DROP CONSTRAINT "risk_controller_reduction_records_collector_id_fkey";

-- AlterTable
ALTER TABLE "risk_controller_reduction_records" ALTER COLUMN "collector_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "risk_controller_reduction_records" ADD CONSTRAINT "risk_controller_reduction_records_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
