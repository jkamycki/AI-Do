CREATE TABLE IF NOT EXISTS vendor_partner_applications (
  id serial PRIMARY KEY,
  business_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  category text NOT NULL,
  service_area text NOT NULL,
  website text,
  instagram text,
  starting_price text,
  description text,
  status text NOT NULL DEFAULT 'new',
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

