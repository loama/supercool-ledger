CREATE FUNCTION lock_runtime_tenant_status(target_tenant_id UUID) RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT status::text
  FROM public.tenants
  WHERE id = target_tenant_id
  FOR SHARE
$$;

REVOKE ALL ON FUNCTION lock_runtime_tenant_status(UUID) FROM PUBLIC;
