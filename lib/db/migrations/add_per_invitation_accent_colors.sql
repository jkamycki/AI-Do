-- Adds per-invitation accent color columns so Save the Date and RSVP Invitation
-- can each have an independent accent color when using Custom Design.
-- Uses IF NOT EXISTS so it is safe to run multiple times.

ALTER TABLE invitation_customizations
  ADD COLUMN IF NOT EXISTS save_the_date_accent_color       TEXT,
  ADD COLUMN IF NOT EXISTS digital_invitation_accent_color  TEXT;
