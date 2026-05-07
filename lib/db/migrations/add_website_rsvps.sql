-- Adds the website_rsvps table for guest RSVP submissions through the public wedding website.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS website_rsvps (
  id                    SERIAL PRIMARY KEY,
  website_id            INTEGER NOT NULL,
  name                  TEXT    NOT NULL,
  email                 TEXT,
  attending             TEXT    NOT NULL DEFAULT 'yes',
  plus_one_count        INTEGER NOT NULL DEFAULT 0,
  dietary_restrictions  TEXT,
  message               TEXT,
  submitted_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_rsvps_website ON website_rsvps(website_id);
CREATE INDEX IF NOT EXISTS idx_website_rsvps_submitted ON website_rsvps(submitted_at DESC);
