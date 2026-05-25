-- Adds the Guest Photo Drop storage table. Safe to run multiple times.

CREATE TABLE IF NOT EXISTS guest_photo_uploads (
  id SERIAL PRIMARY KEY,
  website_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  note TEXT,
  image_url TEXT NOT NULL,
  original_name TEXT,
  content_type TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS guest_photo_uploads_website_id_idx
  ON guest_photo_uploads (website_id);

CREATE INDEX IF NOT EXISTS guest_photo_uploads_profile_id_idx
  ON guest_photo_uploads (profile_id);

CREATE INDEX IF NOT EXISTS guest_photo_uploads_status_idx
  ON guest_photo_uploads (status);
