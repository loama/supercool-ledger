import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { createDatabase } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';

let pool: Pool;

const migrationDirectory = fileURLToPath(new URL('../../migrations/', import.meta.url));

const applyMigrationsThrough006 = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE schema_migrations (
      name TEXT PRIMARY KEY,
      checksum CHAR(64),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const names = [
    '001_initial.sql',
    '002_harden_ledger_boundaries.sql',
    '003_close_commit_invariants.sql',
    '004_sandbox_sessions.sql',
    '005_runtime_role_boundary.sql',
    '006_runtime_tenant_status.sql',
  ];
  for (const name of names) {
    const sql = await Bun.file(`${migrationDirectory}/${name}`).text();
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
      name,
      createHash('sha256').update(sql).digest('hex'),
    ]);
  }
};

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
    'sandbox_sessions',
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
      'account_balance_consistent',
      'journal_transactions_immutable',
      'journal_postings_complete',
      'posting_balance_consistent',
      'posting_context_valid',
      'postings_balanced',
      'postings_immutable',
      'reversal_context_valid',
      'sandbox_session_tenant_guard',
      'transfer_postings_complete',
    ]),
  );

  await pool.query(
    "UPDATE schema_migrations SET checksum = repeat('0', 64) WHERE name = '001_initial.sql'",
  );
  let checksumError: unknown;
  try {
    await migrate(pool);
  } catch (error) {
    checksumError = error;
  }
  expect(checksumError).toMatchObject({
    message: 'migration_checksum_mismatch:001_initial.sql',
  });
  await pool.query("UPDATE schema_migrations SET checksum = NULL WHERE name = '001_initial.sql'");
  await migrate(pool);
});

test('requires an explicit allow list for sessions created before sandbox classification', async () => {
  const client = await pool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
  await applyMigrationsThrough006();

  const tenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Reviewer Sandbox deadbeef') RETURNING id",
  );
  const tenantId = tenant.rows[0]?.id;
  if (!tenantId) throw new Error('upgrade_tenant_fixture_failed');
  await pool.query(
    "INSERT INTO sandbox_sessions (tenant_id, expires_at) VALUES ($1, now() + interval '15 minutes')",
    [tenantId],
  );

  let reviewError: unknown;
  try {
    await migrate(pool);
  } catch (error) {
    reviewError = error;
  }
  expect(reviewError).toBeInstanceOf(Error);
  if (!(reviewError instanceof Error)) throw new Error('expected_migration_review_error');
  expect(reviewError.message).toContain('sandbox session classification requires operator review');
  const unapplied = await pool.query<{ applied: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '007_protect_sandbox_classification.sql') AS applied",
  );
  expect(unapplied.rows[0]?.applied).toBe(false);

  process.env.REVIEWED_SANDBOX_TENANT_IDS = tenantId;
  try {
    await migrate(pool);
  } finally {
    delete process.env.REVIEWED_SANDBOX_TENANT_IDS;
  }
  const classified = await pool.query<{ is_sandbox: boolean }>(
    'SELECT is_sandbox FROM tenants WHERE id = $1',
    [tenantId],
  );
  expect(classified.rows[0]?.is_sandbox).toBe(true);
});
