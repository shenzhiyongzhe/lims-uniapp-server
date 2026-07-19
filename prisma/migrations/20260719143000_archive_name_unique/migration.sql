-- Deduplicate archive names before unique constraint (keep smallest id)
WITH dups AS (
  SELECT id, name,
         ROW_NUMBER() OVER (PARTITION BY name ORDER BY id ASC) AS rn
  FROM "archives"
)
UPDATE "archives" AS a
SET "name" = a."name" || '_dup_' || a."id"::text
FROM dups d
WHERE a."id" = d."id" AND d.rn > 1;

-- Drop non-unique index if present, then add unique
DROP INDEX IF EXISTS "archives_name_idx";

CREATE UNIQUE INDEX "archives_name_key" ON "archives"("name");
