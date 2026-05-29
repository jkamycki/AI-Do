ALTER TABLE "guests"
ADD COLUMN IF NOT EXISTS "plus_one_status" text NOT NULL DEFAULT 'none';

UPDATE "guests"
SET "plus_one_status" = CASE
  WHEN "plus_one" = true AND NULLIF(trim(COALESCE("plus_one_name", '')), '') IS NOT NULL THEN 'named'
  WHEN "plus_one" = true THEN 'name_tbd'
  ELSE 'none'
END
WHERE "plus_one_status" = 'none';
