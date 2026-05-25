-- Adds a privacy-safe per-device upload key for Guest Photo Drop limits.

ALTER TABLE guest_photo_uploads
  ADD COLUMN IF NOT EXISTS uploader_key TEXT;

CREATE INDEX IF NOT EXISTS guest_photo_uploads_website_uploader_key_idx
  ON guest_photo_uploads (website_id, uploader_key);
