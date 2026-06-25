-- AlterTable
ALTER TABLE "staffs" ADD COLUMN     "is_default_pin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pin_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pin_hash" VARCHAR(100);
