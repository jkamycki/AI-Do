CREATE TABLE IF NOT EXISTS vendor_contacts (
  id serial PRIMARY KEY,
  profile_id integer NOT NULL,
  vendor_id integer,
  name text NOT NULL DEFAULT '',
  business_name text,
  email text,
  phone text,
  contact_type text NOT NULL DEFAULT 'General',
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_contacts_profile_id_idx
  ON vendor_contacts (profile_id);

CREATE INDEX IF NOT EXISTS vendor_contacts_profile_vendor_idx
  ON vendor_contacts (profile_id, vendor_id);
