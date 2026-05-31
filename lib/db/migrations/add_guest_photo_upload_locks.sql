CREATE TABLE IF NOT EXISTS guest_photo_upload_locks (
  id serial PRIMARY KEY,
  website_id integer NOT NULL,
  uploader_key text NOT NULL,
  submitted_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_photo_upload_locks_website_uploader_key_idx
  ON guest_photo_upload_locks (website_id, uploader_key);
