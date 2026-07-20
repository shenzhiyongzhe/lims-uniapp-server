-- Run only after backfill-archive-user-id.ts completes with no NULL user_id rows
ALTER TABLE "archives" ALTER COLUMN "user_id" SET NOT NULL;
