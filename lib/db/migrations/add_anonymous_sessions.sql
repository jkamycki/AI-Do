CREATE TABLE IF NOT EXISTS anonymous_sessions (
  id serial PRIMARY KEY,
  session_id text NOT NULL,
  test_mode boolean NOT NULL DEFAULT false,
  event text NOT NULL,
  metadata jsonb,
  timestamp timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  last_active_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anonymous_sessions_session_id_idx
  ON anonymous_sessions (session_id);

CREATE INDEX IF NOT EXISTS anonymous_sessions_test_mode_idx
  ON anonymous_sessions (test_mode);

CREATE INDEX IF NOT EXISTS anonymous_sessions_last_active_at_idx
  ON anonymous_sessions (last_active_at);
