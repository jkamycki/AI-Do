CREATE TABLE IF NOT EXISTS support_tickets (
  id serial PRIMARY KEY,
  ticket_number text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  category text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  user_id text,
  profile_id integer,
  follow_up_notes text,
  follow_up_email text,
  follow_up_sent_at timestamp,
  follow_up_sent_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS profile_id integer,
  ADD COLUMN IF NOT EXISTS follow_up_notes text,
  ADD COLUMN IF NOT EXISTS follow_up_email text,
  ADD COLUMN IF NOT EXISTS follow_up_sent_at timestamp,
  ADD COLUMN IF NOT EXISTS follow_up_sent_by text;

CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_ticket_number_unique
  ON support_tickets (ticket_number);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON support_tickets (status);

CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx
  ON support_tickets (created_at DESC);
