/*
  Warnings:

  - You are about to drop the `daily_statistics` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "daily_statistics" DROP CONSTRAINT "daily_statistics_admin_id_fkey";

-- DropTable
DROP TABLE "daily_statistics";
