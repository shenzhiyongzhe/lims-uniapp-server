-- AlterTable: add nullable user_id to archives
ALTER TABLE "archives" ADD COLUMN "user_id" INTEGER;

-- Drop unique on name (uniqueness moves to user_id)
DROP INDEX IF EXISTS "archives_name_key";

-- Indexes
CREATE UNIQUE INDEX "archives_user_id_key" ON "archives"("user_id");
CREATE INDEX "archives_name_idx" ON "archives"("name");

-- ForeignKey
ALTER TABLE "archives"
  ADD CONSTRAINT "archives_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
