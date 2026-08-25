import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Pool } from 'pg';
import { runDemo } from '../../src/demo/run.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';

let pool: Pool;
let database: Database;

beforeAll(async () => {
  pool = createTestPool();
  const client = await pool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
  await migrate(pool);
  database = createDatabase(testDatabaseUrl);
});

afterAll(async () => {
  await database.close();
  await pool.end();
});

test('captures success replay rejection and reconciliation from the running service', async () => {
  const unrelatedTenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Unrelated Tenant') RETURNING id",
  );
  const unrelatedTenantId = unrelatedTenant.rows[0]?.id;
  if (!unrelatedTenantId) throw new Error('tenant_fixture_failed');
  await pool.query(
    "INSERT INTO accounts (tenant_id, name, currency) VALUES ($1, 'Unrelated', 'USD')",
    [unrelatedTenantId],
  );
  const result = await runDemo(database, 'a-development-secret-with-more-than-32-characters');
  expect(result.success.status).toBe(201);
  expect(result.replay.status).toBe(200);
  expect(result.replay.sameTransfer).toBe(true);
  expect(result.overspend.status).toBe(422);
  expect(result.overspend.code).toBe('insufficient_funds');
  expect(result.reconciliation.discrepancies).toEqual([]);
  expect(result.reconciliation.checkedAccounts).toBe(3);
  expect(JSON.stringify(result)).not.toContain('Bearer ');
  expect(JSON.stringify(result)).not.toContain('demo-transfer-key');
});
