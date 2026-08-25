import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Pool } from 'pg';
import { createDatabase } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';

let pool: Pool;

beforeAll(async () => {
  pool = createTestPool();
  const client = await pool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await pool.end();
});

test('migrates an empty database with the financial tables and triggers', async () => {
  const readinessDatabase = createDatabase(testDatabaseUrl);
  let readinessError: unknown;
  try {
    await readinessDatabase.ping();
  } catch (error) {
    readinessError = error;
  }
  expect(readinessError).toMatchObject({ message: 'database_schema_not_ready' });
  await Promise.all([migrate(pool), migrate(pool)]);
  await readinessDatabase.ping();
  await readinessDatabase.close();

  const tables = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  expect(tables.rows.map((row) => row.tablename)).toEqual([
    'accounts',
    'audit_events',
    'idempotency_records',
    'journal_transactions',
    'postings',
    'schema_migrations',
    'tenants',
    'transfers',
  ]);

  const triggers = await pool.query<{ trigger_name: string }>(`
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
    ORDER BY trigger_name
  `);
  expect(new Set(triggers.rows.map((row) => row.trigger_name))).toEqual(
    new Set([
      'audit_events_immutable',
      'journal_transactions_immutable',
      'posting_context_valid',
      'postings_balanced',
      'postings_immutable',
      'reversal_context_valid',
    ]),
  );
});
