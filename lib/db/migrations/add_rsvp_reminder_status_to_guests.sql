-- Track whether the planner has sent the RSVP reminder ("you haven't RSVP'd
-- yet") email to each guest. Mirrors save_the_date_status. Defaults to
-- "not_sent" so existing guests aren't flagged as already nudged.
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS rsvp_reminder_status TEXT NOT NULL DEFAULT 'not_sent';
