CREATE TABLE IF NOT EXISTS maintenance_flags (
  id SERIAL PRIMARY KEY,
  section TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  message TEXT,
  expires_at TIMESTAMP,
  updated_by TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
