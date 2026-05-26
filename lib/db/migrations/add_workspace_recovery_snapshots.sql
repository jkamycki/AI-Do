CREATE TABLE IF NOT EXISTS workspace_recovery_snapshots (
  id serial PRIMARY KEY,
  profile_id integer NOT NULL,
  user_id text NOT NULL,
  reason text NOT NULL,
  resource_type text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL,
  restored_at timestamp,
  restored_by text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_recovery_snapshots_profile_created_idx
  ON workspace_recovery_snapshots (profile_id, created_at DESC);
