ALTER TABLE mood_boards
  ADD COLUMN IF NOT EXISTS profile_id integer;

UPDATE mood_boards mb
SET profile_id = wp.id
FROM (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM wedding_profiles
  ORDER BY user_id, id
) wp
WHERE mb.profile_id IS NULL
  AND mb.user_id = wp.user_id;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'mood_boards'
    AND con.contype = 'u'
    AND att.attname = 'user_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE mood_boards DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS mood_boards_profile_id_unique
  ON mood_boards (profile_id)
  WHERE profile_id IS NOT NULL;
