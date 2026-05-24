ALTER TABLE wedding_profiles
  ADD COLUMN IF NOT EXISTS task_email_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS task_reminder_days_before INTEGER NOT NULL DEFAULT 7;
