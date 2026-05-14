ALTER TABLE wedding_profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'couple_individual';

