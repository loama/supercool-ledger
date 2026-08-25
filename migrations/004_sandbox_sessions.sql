CREATE TABLE sandbox_sessions (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX sandbox_sessions_created_idx ON sandbox_sessions (created_at);
CREATE INDEX sandbox_sessions_expires_idx ON sandbox_sessions (expires_at);
