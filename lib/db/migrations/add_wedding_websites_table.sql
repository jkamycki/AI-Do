-- Adds the wedding_websites table for the public wedding website builder.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS wedding_websites (
  id              SERIAL PRIMARY KEY,
  profile_id      INTEGER NOT NULL UNIQUE,
  slug            TEXT    NOT NULL UNIQUE,
  theme           TEXT    NOT NULL DEFAULT 'classic',
  layout_style    TEXT    NOT NULL DEFAULT 'standard',
  font            TEXT    NOT NULL DEFAULT 'Playfair Display',
  accent_color    TEXT    NOT NULL DEFAULT '#D4A017',
  color_palette   JSONB   NOT NULL DEFAULT '{
    "primary":"#D4A017","secondary":"#F5C842","accent":"#D4A017",
    "neutral":"#E8E0D0","background":"#FFFFFF","text":"#222222"
  }'::jsonb,
  sections_enabled JSONB  NOT NULL DEFAULT '{
    "welcome":true,"story":true,"schedule":true,"travel":true,
    "registry":true,"faq":true,"gallery":true,"weddingParty":true
  }'::jsonb,
  custom_text     JSONB   NOT NULL DEFAULT '{}'::jsonb,
  gallery_images  JSONB   NOT NULL DEFAULT '[]'::jsonb,
  hero_image      TEXT,
  password        TEXT,
  published       BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMP,
  last_updated    TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wedding_websites_slug      ON wedding_websites(slug);
CREATE INDEX IF NOT EXISTS idx_wedding_websites_profile   ON wedding_websites(profile_id);
CREATE INDEX IF NOT EXISTS idx_wedding_websites_published ON wedding_websites(published);
