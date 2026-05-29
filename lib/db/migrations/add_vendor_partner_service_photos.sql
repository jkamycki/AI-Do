ALTER TABLE "vendor_partner_applications"
ADD COLUMN IF NOT EXISTS "service_photos" jsonb NOT NULL DEFAULT '[]'::jsonb;
