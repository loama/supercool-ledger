import { afterAll, beforeEach, expect, test } from 'bun:test';
import type { Pool } from 'pg';
import { verifyToken } from '../../src/auth/token.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { ServiceError } from '../../src/platform/problem.ts';
import { SandboxService } from '../../src/sandbox/service.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';

const authSecret = 'a-development-secret-with-more-than-32-characters';
let database: Database | null = null;
let pool: Pool | null = null;

beforeEach(async () => {
  await database?.close();
  await pool?.end();
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
  await database?.close();
  await pool?.end();
});

test('creates an isolated balanced reviewer session and scoped token', async () => {
  if (!database || !pool) throw new Error('sandbox_test_setup_missing');
  const service = new SandboxService(database, authSecret, {
    activeLimit: 20,
    dailyLimit: 20,
  });

  const session = await service.createSession();

  expect(session.accounts).toHaveLength(2);
  expect(session.accounts.map((account) => account.balance)).toEqual(['1000.00', '0.00']);
  expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  expect(session.token).not.toContain(authSecret);

  const claims = await verifyToken(session.token, authSecret);
  expect(claims).toEqual({
    subject: 'sandbox-reviewer',
    tenantId: session.tenantId,
    scopes: ['accounts:read', 'transfers:read', 'transfers:write', 'operations:read'],
  });

  const ledger = await pool.query<{ total: string; count: string }>(
    `SELECT COALESCE(sum(p.amount_minor), 0)::text AS total, count(*)::text AS count
     FROM postings p
     WHERE p.tenant_id = $1`,
    [session.tenantId],
  );
  expect(ledger.rows[0]).toEqual({ total: '0', count: '2' });

  const stored = await pool.query<{ expires_at: Date }>(
    'SELECT expires_at FROM sandbox_sessions WHERE tenant_id = $1',
    [session.tenantId],
  );
  expect(stored.rows[0]?.expires_at.toISOString()).toBe(session.expiresAt);
});

test('serializes active admission and recovers after expiration', async () => {
  if (!database || !pool) throw new Error('sandbox_test_setup_missing');
  const service = new SandboxService(database, authSecret, {
    activeLimit: 1,
    dailyLimit: 10,
  });

  const results = await Promise.allSettled([service.createSession(), service.createSession()]);
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');

  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0]?.reason).toBeInstanceOf(ServiceError);
  expect((rejected[0]?.reason as ServiceError).code).toBe('sandbox_capacity_reached');

  const count = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM sandbox_sessions',
  );
  expect(count.rows[0]?.count).toBe('1');

  await pool.query(
    `UPDATE sandbox_sessions
     SET created_at = now() - interval '20 minutes',
         expires_at = now() - interval '5 minutes'`,
  );

  const replacement = await service.createSession();
  expect(replacement.accounts).toHaveLength(2);

  const recoveredCount = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM sandbox_sessions',
  );
  expect(recoveredCount.rows[0]?.count).toBe('2');
});

test('purges only sandbox tenants after the seven day retention period', async () => {
  if (!database || !pool) throw new Error('sandbox_test_setup_missing');
  const service = new SandboxService(database, authSecret, {
    activeLimit: 20,
    dailyLimit: 20,
  });
  const expired = await service.createSession();

  await pool.query(
    `UPDATE sandbox_sessions
     SET created_at = now() - interval '8 days',
         expires_at = now() - interval '8 days' + interval '15 minutes'
     WHERE tenant_id = $1`,
    [expired.tenantId],
  );

  const replacement = await service.createSession();
  const removed = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM tenants WHERE id = $1',
    [expired.tenantId],
  );
  const retained = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM tenants WHERE id = $1',
    [replacement.tenantId],
  );

  expect(removed.rows[0]?.count).toBe('0');
  expect(retained.rows[0]?.count).toBe('1');
});
