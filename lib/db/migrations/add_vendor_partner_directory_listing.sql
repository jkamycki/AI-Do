ALTER TABLE "vendor_partner_applications"
  ADD COLUMN IF NOT EXISTS "business_logo" jsonb,
  ADD COLUMN IF NOT EXISTS "directory_listing" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "directory_status" text NOT NULL DEFAULT 'not_created',
  ADD COLUMN IF NOT EXISTS "directory_published_at" timestamp;
