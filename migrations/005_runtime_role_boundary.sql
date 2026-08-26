ALTER FUNCTION purge_expired_sandbox_tenants()
  SECURITY DEFINER
  SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION purge_expired_sandbox_tenants() FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
