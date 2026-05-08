-- Adds a separate hero_images column to wedding_websites so the home page
-- slideshow/marquee uses its own photo pool, separate from the gallery section.
ALTER TABLE wedding_websites
  ADD COLUMN IF NOT EXISTS hero_images JSONB NOT NULL DEFAULT '[]'::jsonb;
