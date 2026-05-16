ALTER TABLE wedding_profiles
  ADD COLUMN IF NOT EXISTS venue_status text NOT NULL DEFAULT 'booked',
  ADD COLUMN IF NOT EXISTS venue_discovery jsonb,
  ADD COLUMN IF NOT EXISTS venue_brainstorm jsonb;
