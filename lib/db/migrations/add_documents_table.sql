CREATE TABLE IF NOT EXISTS documents (
  id serial PRIMARY KEY,
  profile_id integer NOT NULL,
  user_id text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  original_file_name text NOT NULL,
  file_type text NOT NULL,
  mime_type text NOT NULL,
  file_size integer,
  uploaded_by text NOT NULL,
  linked_vendor_id integer,
  summary text,
  extracted_fields jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  folder text NOT NULL DEFAULT 'General',
  visibility jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_text text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_profile_id_idx ON documents(profile_id);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_linked_vendor_id_idx ON documents(linked_vendor_id);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at);
