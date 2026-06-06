-- AlterEnum
ALTER TYPE "ManagementRoles" ADD VALUE 'SUPER_ADMIN';

-- Rename Table
ALTER TABLE "admins" RENAME TO "staffs";

-- Rename Constraints & Indexes
ALTER TABLE "staffs" RENAME CONSTRAINT "admins_pkey" TO "staffs_pkey";
ALTER INDEX "admins_openid_key" RENAME TO "staffs_openid_key";
