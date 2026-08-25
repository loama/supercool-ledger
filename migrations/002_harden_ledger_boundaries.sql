ALTER TABLE accounts
  ADD CONSTRAINT accounts_identity_tenant_currency_unique UNIQUE (id, tenant_id, currency);

ALTER TABLE journal_transactions
  ADD CONSTRAINT journal_identity_tenant_unique UNIQUE (id, tenant_id);

ALTER TABLE postings ADD COLUMN tenant_id UUID;

UPDATE postings p
SET tenant_id = j.tenant_id
FROM journal_transactions j
WHERE j.id = p.journal_transaction_id;

ALTER TABLE postings ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE postings
  ADD CONSTRAINT postings_journal_tenant_fk
    FOREIGN KEY (journal_transaction_id, tenant_id)
    REFERENCES journal_transactions (id, tenant_id),
  ADD CONSTRAINT postings_account_tenant_currency_fk
    FOREIGN KEY (account_id, tenant_id, currency)
    REFERENCES accounts (id, tenant_id, currency);

ALTER TABLE transfers
  ADD CONSTRAINT transfers_source_tenant_currency_fk
    FOREIGN KEY (source_account_id, tenant_id, currency)
    REFERENCES accounts (id, tenant_id, currency),
  ADD CONSTRAINT transfers_destination_tenant_currency_fk
    FOREIGN KEY (destination_account_id, tenant_id, currency)
    REFERENCES accounts (id, tenant_id, currency),
  ADD CONSTRAINT transfers_journal_tenant_fk
    FOREIGN KEY (journal_transaction_id, tenant_id)
    REFERENCES journal_transactions (id, tenant_id);

CREATE FUNCTION set_and_verify_posting_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  journal_tenant UUID;
BEGIN
  SELECT tenant_id INTO journal_tenant
  FROM journal_transactions
  WHERE id = NEW.journal_transaction_id;

  IF journal_tenant IS NULL THEN
    RAISE EXCEPTION 'posting journal does not exist'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := journal_tenant;
  ELSIF NEW.tenant_id <> journal_tenant THEN
    RAISE EXCEPTION 'posting tenant must match journal tenant'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER posting_context_valid
  BEFORE INSERT ON postings
  FOR EACH ROW EXECUTE FUNCTION set_and_verify_posting_context();

CREATE FUNCTION verify_reversal_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  original_tenant UUID;
BEGIN
  IF NEW.reverses_transaction_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO original_tenant
  FROM journal_transactions
  WHERE id = NEW.reverses_transaction_id;

  IF original_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'reversal tenant must match original journal tenant'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reversal_context_valid
  BEFORE INSERT ON journal_transactions
  FOR EACH ROW EXECUTE FUNCTION verify_reversal_context();

CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
