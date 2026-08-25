import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Pool } from 'pg';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase } from '../helpers/database.ts';

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
  await migrate(pool);

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
    new Set(['journal_transactions_immutable', 'postings_balanced', 'postings_immutable']),
  );
});
