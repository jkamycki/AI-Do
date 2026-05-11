-- Adds an optional RSVP-by deadline to invitation customizations. Stored as
-- text in YYYY-MM-DD form so it round-trips through <input type="date"> and
-- JSON without timezone surprises. Idempotent so it is safe to re-run.

ALTER TABLE invitation_customizations
  ADD COLUMN IF NOT EXISTS rsvp_by_date TEXT;
