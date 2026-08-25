CREATE FUNCTION verify_journal_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  posting_count INTEGER;
  currency_count INTEGER;
  posting_sum NUMERIC;
BEGIN
  SELECT count(*), count(DISTINCT currency), COALESCE(sum(amount_minor), 0)
    INTO posting_count, currency_count, posting_sum
    FROM postings
    WHERE journal_transaction_id = NEW.id;

  IF posting_count < 2 OR currency_count <> 1 OR posting_sum <> 0 THEN
    RAISE EXCEPTION 'journal transaction must contain balanced postings in one currency'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER journal_postings_complete
  AFTER INSERT ON journal_transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION verify_journal_complete();

CREATE FUNCTION verify_transfer_postings() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  matching_count INTEGER;
BEGIN
  SELECT count(*) INTO matching_count
  FROM postings p
  WHERE p.journal_transaction_id = NEW.journal_transaction_id
    AND p.tenant_id = NEW.tenant_id
    AND p.currency = NEW.currency
    AND (
      (p.account_id = NEW.source_account_id AND p.amount_minor = -NEW.amount_minor)
      OR
      (p.account_id = NEW.destination_account_id AND p.amount_minor = NEW.amount_minor)
    );

  IF matching_count <> 2 OR
     (SELECT count(*) FROM postings WHERE journal_transaction_id = NEW.journal_transaction_id) <> 2 THEN
    RAISE EXCEPTION 'completed transfer must have exact source and destination postings'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER transfer_postings_complete
  AFTER INSERT ON transfers
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION verify_transfer_postings();

CREATE FUNCTION verify_account_balance_value(target_account_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  cached_value BIGINT;
  ledger_value NUMERIC;
BEGIN
  SELECT balance_minor INTO cached_value FROM accounts WHERE id = target_account_id;
  SELECT COALESCE(sum(amount_minor), 0) INTO ledger_value
  FROM postings
  WHERE account_id = target_account_id;

  IF cached_value IS NULL OR cached_value::numeric <> ledger_value THEN
    RAISE EXCEPTION 'cached balance must equal immutable postings'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
END;
$$;

CREATE FUNCTION verify_updated_account_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM verify_account_balance_value(NEW.id);
  RETURN NULL;
END;
$$;

CREATE FUNCTION verify_posted_account_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM verify_account_balance_value(NEW.account_id);
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER account_balance_consistent
  AFTER INSERT OR UPDATE OF balance_minor ON accounts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION verify_updated_account_balance();

CREATE CONSTRAINT TRIGGER posting_balance_consistent
  AFTER INSERT ON postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION verify_posted_account_balance();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM journal_transactions j
    LEFT JOIN postings p ON p.journal_transaction_id = j.id
    GROUP BY j.id
    HAVING count(p.id) < 2 OR count(DISTINCT p.currency) <> 1 OR COALESCE(sum(p.amount_minor), 0) <> 0
  ) THEN
    RAISE EXCEPTION 'existing journal data violates posting invariants';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM accounts a
    LEFT JOIN postings p ON p.account_id = a.id
    GROUP BY a.id, a.balance_minor
    HAVING a.balance_minor::numeric <> COALESCE(sum(p.amount_minor), 0)
  ) THEN
    RAISE EXCEPTION 'existing account data violates balance invariants';
  END IF;
END;
$$;
