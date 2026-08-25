import { afterAll, beforeEach, expect, test } from 'bun:test';
import type { Pool } from 'pg';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { reconcile } from '../../src/reconciliation/service.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';
import { fundAccount } from '../helpers/ledger.ts';

const pool: Pool = createTestPool();
const database: Database = createDatabase(testDatabaseUrl);
let tenantId: string;
let accountId: string;

beforeEach(async () => {
  const client = await pool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
  await migrate(pool);
  const tenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Reconciliation Test') RETURNING id",
  );
  const tenantRow = tenant.rows[0];
  if (!tenantRow) throw new Error('tenant_fixture_failed');
  tenantId = tenantRow.id;
  const account = await pool.query<{ id: string }>(
    "INSERT INTO accounts (tenant_id, name, currency) VALUES ($1, 'Operating', 'USD') RETURNING id",
    [tenantId],
  );
  const accountRow = account.rows[0];
  if (!accountRow) throw new Error('account_fixture_failed');
  accountId = accountRow.id;
  await fundAccount(pool, tenantId, accountId, 'USD', 5_000n);
});

afterAll(async () => {
  await database.close();
  await pool.end();
});

test('reports a clean ledger', async () => {
  const result = await reconcile(database);
  expect(result.discrepancies).toEqual([]);
  expect(result.checkedAccounts).toBeGreaterThanOrEqual(2);
});

test('detects drift without repairing the cached balance', async () => {
  await pool.query('ALTER TABLE accounts DISABLE TRIGGER account_balance_consistent');
  try {
    await pool.query('UPDATE accounts SET balance_minor = 4999 WHERE id = $1', [accountId]);
  } finally {
    await pool.query('ALTER TABLE accounts ENABLE TRIGGER account_balance_consistent');
  }
  const result = await reconcile(database);
  expect(result.discrepancies).toEqual([{ accountId, cachedMinor: '4999', ledgerMinor: '5000' }]);
  const after = await pool.query<{ balance_minor: string }>(
    'SELECT balance_minor FROM accounts WHERE id = $1',
    [accountId],
  );
  expect(after.rows[0]?.balance_minor).toBe('4999');
});
