ALTER TABLE tenants ADD COLUMN is_sandbox BOOLEAN NOT NULL DEFAULT false;

DO $$
DECLARE
  reviewed_setting TEXT := coalesce(
    current_setting('app.reviewed_sandbox_tenant_ids', true),
    ''
  );
  reviewed_ids UUID[] := CASE
    WHEN trim(reviewed_setting) = '' THEN ARRAY[]::UUID[]
    ELSE regexp_split_to_array(
      reviewed_setting,
      '\s*,\s*'
    )::UUID[]
  END;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sandbox_sessions AS sessions
    WHERE NOT sessions.tenant_id = ANY(reviewed_ids)
  ) THEN
    RAISE EXCEPTION 'sandbox session classification requires operator review';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(reviewed_ids) AS reviewed(tenant_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM sandbox_sessions AS sessions
      WHERE sessions.tenant_id = reviewed.tenant_id
    )
  ) THEN
    RAISE EXCEPTION 'reviewed sandbox tenant is not an existing session';
  END IF;

  UPDATE tenants
  SET is_sandbox = true
  WHERE id = ANY(reviewed_ids);
END;
$$;

CREATE FUNCTION create_sandbox_tenant(target_name TEXT) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  created_tenant_id UUID;
BEGIN
  IF target_name !~ '^Reviewer Sandbox [0-9a-f]{8}$' THEN
    RAISE EXCEPTION 'invalid sandbox tenant name' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.tenants (name, is_sandbox)
  VALUES (target_name, true)
  RETURNING id INTO created_tenant_id;
  RETURN created_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION create_sandbox_tenant(TEXT) FROM PUBLIC;

CREATE FUNCTION record_sandbox_session(
  target_tenant_id UUID,
  target_expires_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF target_expires_at <= now() OR target_expires_at > now() + interval '20 minutes' THEN
    RAISE EXCEPTION 'invalid sandbox expiration' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE id = target_tenant_id
      AND is_sandbox = true
  ) THEN
    RAISE EXCEPTION 'tenant is not a sandbox' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.sandbox_sessions (tenant_id, expires_at)
  VALUES (target_tenant_id, target_expires_at);
END;
$$;

REVOKE ALL ON FUNCTION record_sandbox_session(UUID, TIMESTAMPTZ) FROM PUBLIC;

CREATE FUNCTION reject_non_sandbox_session() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE id = NEW.tenant_id
      AND is_sandbox = true
  ) THEN
    RAISE EXCEPTION 'tenant is not a sandbox' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sandbox_session_tenant_guard
BEFORE INSERT OR UPDATE ON sandbox_sessions
FOR EACH ROW EXECUTE FUNCTION reject_non_sandbox_session();

CREATE OR REPLACE FUNCTION purge_expired_sandbox_tenants() RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  expired_tenant UUID;
  purged_count INTEGER := 0;
BEGIN
  FOR expired_tenant IN
    SELECT sessions.tenant_id
    FROM public.sandbox_sessions AS sessions
    INNER JOIN public.tenants AS tenants
      ON tenants.id = sessions.tenant_id
     AND tenants.is_sandbox = true
    WHERE sessions.expires_at <= now() - interval '7 days'
    ORDER BY sessions.expires_at
    LIMIT 25
    FOR UPDATE OF sessions SKIP LOCKED
  LOOP
    DELETE FROM public.audit_events WHERE tenant_id = expired_tenant;
    DELETE FROM public.idempotency_records WHERE tenant_id = expired_tenant;
    DELETE FROM public.transfers WHERE tenant_id = expired_tenant;
    DELETE FROM public.postings WHERE tenant_id = expired_tenant;
    DELETE FROM public.journal_transactions WHERE tenant_id = expired_tenant;
    DELETE FROM public.accounts WHERE tenant_id = expired_tenant;
    DELETE FROM public.sandbox_sessions WHERE tenant_id = expired_tenant;
    DELETE FROM public.tenants WHERE id = expired_tenant AND is_sandbox = true;
    purged_count := purged_count + 1;
  END LOOP;

  RETURN purged_count;
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_sandbox_tenants() FROM PUBLIC;
