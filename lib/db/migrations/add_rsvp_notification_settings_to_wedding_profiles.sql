ALTER TABLE wedding_profiles
  ADD COLUMN IF NOT EXISTS rsvp_email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS rsvp_notification_emails JSONB;
