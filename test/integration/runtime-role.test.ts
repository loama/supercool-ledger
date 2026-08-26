import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { migrate } from '../../src/platform/migrate.ts';
import { provisionRuntimeRole } from '../../src/platform/runtime-role.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';

const username = `runtime_${randomUUID().replaceAll('-', '')}`;
const password = 'runtime-role-password-with-more-than-20-characters';
let adminPool: Pool;
let runtimePool: Pool;

beforeAll(async () => {
  adminPool = createTestPool();
  const client = await adminPool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
  await migrate(adminPool);
  await provisionRuntimeRole(adminPool, { username, password });
  const url = new URL(testDatabaseUrl);
  url.username = username;
  url.password = password;
  runtimePool = new Pool({ connectionString: url.toString() });
});

afterAll(async () => {
  await runtimePool.end();
  await adminPool.query(`DROP OWNED BY "${username}"`);
  await adminPool.query(`DROP ROLE "${username}"`);
  await adminPool.end();
});

test('runtime role can use application tables without migration access', async () => {
  const tenant = await runtimePool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Runtime Role Test') RETURNING id",
  );
  expect(tenant.rows[0]?.id).toBeDefined();

  const privileges = await runtimePool.query<{
    can_create_schema_object: boolean;
    can_delete_postings: boolean;
    can_execute_sandbox_purge: boolean;
    can_read_migrations: boolean;
    can_update_accounts: boolean;
  }>(`
    SELECT
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema_object,
      has_table_privilege(current_user, 'postings', 'DELETE') AS can_delete_postings,
      has_function_privilege(current_user, 'purge_expired_sandbox_tenants()', 'EXECUTE') AS can_execute_sandbox_purge,
      has_table_privilege(current_user, 'schema_migrations', 'SELECT') AS can_read_migrations,
      has_table_privilege(current_user, 'accounts', 'UPDATE') AS can_update_accounts
  `);
  expect(privileges.rows[0]).toEqual({
    can_create_schema_object: false,
    can_delete_postings: false,
    can_execute_sandbox_purge: true,
    can_read_migrations: false,
    can_update_accounts: true,
  });
});
