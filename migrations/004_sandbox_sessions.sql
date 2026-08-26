CREATE TABLE sandbox_sessions (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX sandbox_sessions_created_idx ON sandbox_sessions (created_at);
CREATE INDEX sandbox_sessions_expires_idx ON sandbox_sessions (expires_at);

CREATE OR REPLACE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1
    FROM sandbox_sessions
    WHERE tenant_id = OLD.tenant_id
      AND expires_at <= now() - interval '7 days'
  ) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'posted ledger data is immutable' USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE FUNCTION purge_expired_sandbox_tenants() RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  expired_tenant UUID;
  purged_count INTEGER := 0;
BEGIN
  FOR expired_tenant IN
    SELECT tenant_id
    FROM sandbox_sessions
    WHERE expires_at <= now() - interval '7 days'
    ORDER BY expires_at
    LIMIT 25
    FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM audit_events WHERE tenant_id = expired_tenant;
    DELETE FROM idempotency_records WHERE tenant_id = expired_tenant;
    DELETE FROM transfers WHERE tenant_id = expired_tenant;
    DELETE FROM postings WHERE tenant_id = expired_tenant;
    DELETE FROM journal_transactions WHERE tenant_id = expired_tenant;
    DELETE FROM accounts WHERE tenant_id = expired_tenant;
    DELETE FROM sandbox_sessions WHERE tenant_id = expired_tenant;
    DELETE FROM tenants WHERE id = expired_tenant;
    purged_count := purged_count + 1;
  END LOOP;

  RETURN purged_count;
END;
$$;
