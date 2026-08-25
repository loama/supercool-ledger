CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  currency CHAR(3) NOT NULL CHECK (currency IN ('USD', 'MXN')),
  kind TEXT NOT NULL DEFAULT 'customer' CHECK (kind IN ('customer', 'system')),
  balance_minor BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (kind = 'system' OR balance_minor >= 0)
);

CREATE INDEX accounts_tenant_created_idx ON accounts (tenant_id, created_at, id);

CREATE TABLE journal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  kind TEXT NOT NULL CHECK (kind IN ('opening', 'transfer', 'reversal')),
  reference TEXT NOT NULL,
  reverses_transaction_id UUID UNIQUE REFERENCES journal_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX journal_transactions_tenant_created_idx
  ON journal_transactions (tenant_id, created_at, id);

CREATE TABLE postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_transaction_id UUID NOT NULL REFERENCES journal_transactions(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  currency CHAR(3) NOT NULL CHECK (currency IN ('USD', 'MXN')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor <> 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX postings_account_created_idx ON postings (account_id, created_at, id);
CREATE INDEX postings_journal_idx ON postings (journal_transaction_id);

CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_account_id UUID NOT NULL REFERENCES accounts(id),
  destination_account_id UUID NOT NULL REFERENCES accounts(id),
  currency CHAR(3) NOT NULL CHECK (currency IN ('USD', 'MXN')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  journal_transaction_id UUID NOT NULL UNIQUE REFERENCES journal_transactions(id),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_account_id <> destination_account_id)
);

CREATE INDEX transfers_tenant_created_idx ON transfers (tenant_id, created_at, id);

CREATE TABLE idempotency_records (
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash CHAR(64) NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('processing', 'completed')),
  response_status INTEGER,
  response_body JSONB,
  resource_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, scope, key),
  CHECK (
    (state = 'processing' AND response_status IS NULL AND response_body IS NULL AND completed_at IS NULL)
    OR
    (state = 'completed' AND response_status IS NOT NULL AND response_body IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  request_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_tenant_created_idx ON audit_events (tenant_id, created_at, id);

CREATE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'posted ledger data is immutable' USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER journal_transactions_immutable
  BEFORE UPDATE OR DELETE ON journal_transactions
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TRIGGER postings_immutable
  BEFORE UPDATE OR DELETE ON postings
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE FUNCTION verify_balanced_postings() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_id UUID;
  posting_count INTEGER;
  currency_count INTEGER;
  posting_sum NUMERIC;
BEGIN
  target_id := COALESCE(NEW.journal_transaction_id, OLD.journal_transaction_id);
  SELECT count(*), count(DISTINCT currency), COALESCE(sum(amount_minor), 0)
    INTO posting_count, currency_count, posting_sum
    FROM postings
    WHERE journal_transaction_id = target_id;

  IF posting_count < 2 OR currency_count <> 1 OR posting_sum <> 0 THEN
    RAISE EXCEPTION 'journal transaction must contain balanced postings in one currency'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER postings_balanced
  AFTER INSERT ON postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION verify_balanced_postings();
