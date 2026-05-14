ALTER TABLE vendor_contracts
  ADD COLUMN IF NOT EXISTS profile_id integer;

UPDATE vendor_contracts vc
SET profile_id = wp.id
FROM (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM wedding_profiles
  ORDER BY user_id, id
) wp
WHERE vc.profile_id IS NULL
  AND vc.user_id = wp.user_id;
