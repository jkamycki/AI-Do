-- Track when a guest submitted their RSVP. Distinct from rsvpSentAt
-- (when the invitation went out) and from rsvpStatus (what they chose).
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS rsvp_responded_at TIMESTAMP;
