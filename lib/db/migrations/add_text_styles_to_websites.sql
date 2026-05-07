ALTER TABLE wedding_websites ADD COLUMN IF NOT EXISTS text_styles jsonb NOT NULL DEFAULT '{}';
