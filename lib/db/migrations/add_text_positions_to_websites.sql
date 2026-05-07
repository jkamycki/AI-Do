ALTER TABLE wedding_websites ADD COLUMN IF NOT EXISTS text_positions jsonb NOT NULL DEFAULT '{}';
