ALTER TABLE hotel_blocks
  ADD COLUMN IF NOT EXISTS profile_id integer;

ALTER TABLE wedding_party
  ADD COLUMN IF NOT EXISTS profile_id integer;

UPDATE hotel_blocks hb
SET profile_id = wp.id
FROM (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM wedding_profiles
  ORDER BY user_id, id
) wp
WHERE hb.profile_id IS NULL
  AND hb.user_id = wp.user_id;

UPDATE wedding_party party
SET profile_id = wp.id
FROM (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM wedding_profiles
  ORDER BY user_id, id
) wp
WHERE party.profile_id IS NULL
  AND party.user_id = wp.user_id;

UPDATE seating_charts sc
SET profile_id = wp.id
FROM (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM wedding_profiles
  ORDER BY user_id, id
) wp
WHERE sc.profile_id IS NULL
  AND sc.user_id = wp.user_id;
