ALTER TABLE wedding_profiles
  ADD COLUMN IF NOT EXISTS planning_priorities jsonb DEFAULT '{"mustHaves":[],"niceToHaves":[],"mustAvoids":[]}'::jsonb;
