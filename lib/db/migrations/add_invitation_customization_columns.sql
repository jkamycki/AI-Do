-- Adds columns that exist in the Drizzle schema but may be missing from the
-- production database because drizzle-kit push was never re-run after they
-- were added.  All statements use IF NOT EXISTS so they are safe to run
-- multiple times.

ALTER TABLE invitation_customizations
  ADD COLUMN IF NOT EXISTS save_the_date_photo_url          TEXT,
  ADD COLUMN IF NOT EXISTS digital_invitation_photo_url     TEXT,
  ADD COLUMN IF NOT EXISTS save_the_date_photo_position     JSONB,
  ADD COLUMN IF NOT EXISTS digital_invitation_photo_position JSONB,
  ADD COLUMN IF NOT EXISTS save_the_date_font               TEXT DEFAULT 'Playfair Display',
  ADD COLUMN IF NOT EXISTS digital_invitation_font          TEXT DEFAULT 'Playfair Display',
  ADD COLUMN IF NOT EXISTS save_the_date_layout             TEXT DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS digital_invitation_layout        TEXT DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS background_image_url             TEXT,
  ADD COLUMN IF NOT EXISTS save_the_date_background         TEXT,
  ADD COLUMN IF NOT EXISTS digital_invitation_background    TEXT,
  ADD COLUMN IF NOT EXISTS text_overrides                   JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS use_generated_invitation         BOOLEAN NOT NULL DEFAULT true;
