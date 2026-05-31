-- Adds indexes for high-traffic production paths. Safe to replay on every boot.

CREATE INDEX IF NOT EXISTS analytics_events_user_timestamp_id_idx
  ON analytics_events (user_id, timestamp DESC, id DESC);

CREATE INDEX IF NOT EXISTS analytics_events_type_timestamp_idx
  ON analytics_events (event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS anonymous_sessions_session_timestamp_idx
  ON anonymous_sessions (session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS guest_photo_uploads_website_uploaded_id_idx
  ON guest_photo_uploads (website_id, uploaded_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS guest_photo_uploads_website_status_idx
  ON guest_photo_uploads (website_id, status);

CREATE INDEX IF NOT EXISTS guest_photo_uploads_website_image_url_idx
  ON guest_photo_uploads (website_id, image_url);
