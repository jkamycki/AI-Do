CREATE TABLE IF NOT EXISTS mood_boards (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  profile_id integer,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  color_palette jsonb NOT NULL DEFAULT '[]'::jsonb,
  style_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_summary text,
  notes text,
  updated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE mood_boards
  ADD COLUMN IF NOT EXISTS profile_id integer,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS color_palette jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS style_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS mood_boards_profile_id_unique
  ON mood_boards (profile_id)
  WHERE profile_id IS NOT NULL;
