-- AlterTable
ALTER TABLE `admins` DROP COLUMN `email`;

-- AlterTable
ALTER TABLE `admins` ADD COLUMN `username` VARCHAR(10) NULL;

-- Backfill username from nickname (max 10 chars) where possible
UPDATE `admins`
SET `username` = LEFT(TRIM(`nickname`), 10)
WHERE `username` IS NULL
  AND `nickname` IS NOT NULL
  AND TRIM(`nickname`) <> '';
