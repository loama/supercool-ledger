import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import { signDevelopmentToken } from '../../src/auth/token.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';
import { fundAccount } from '../helpers/ledger.ts';

const authSecret = 'a-development-secret-with-more-than-32-characters';
let app: FastifyInstance;
let database: Database;
let pool: Pool;
let token: string;
let tenantId: string;
let sourceId: string;
let destinationId: string;

beforeAll(async () => {
  pool = createTestPool();
  const client = await pool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
  await migrate(pool);
  const tenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Transfer Test') RETURNING id",
  );
  const tenantRow = tenant.rows[0];
  if (!tenantRow) throw new Error('tenant_fixture_failed');
  tenantId = tenantRow.id;
  const accounts = await pool.query<{ id: string }>(
    `INSERT INTO accounts (tenant_id, name, currency)
     VALUES ($1, 'Source', 'USD'), ($1, 'Destination', 'USD') RETURNING id`,
    [tenantId],
  );
  const source = accounts.rows[0];
  const destination = accounts.rows[1];
  if (!source || !destination) throw new Error('account_fixture_failed');
  sourceId = source.id;
  destinationId = destination.id;
  await fundAccount(pool, tenantId, sourceId, 'USD', 100_000n);
  token = await signDevelopmentToken(
    {
      subject: 'reviewer',
      tenantId,
      scopes: ['transfers:read', 'transfers:write'],
    },
    authSecret,
  );
  database = createDatabase(testDatabaseUrl);
  app = await buildApp({ database, authSecret, metricsToken: 'metrics-test-token' });
});

afterAll(async () => {
  await app.close();
  await database.close();
  await pool.end();
});

const transfer = async (key: string, amount = '250.00') =>
  app.inject({
    method: 'POST',
    url: '/v1/transfers',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: {
      sourceAccountId: sourceId,
      destinationAccountId: destinationId,
      amount,
      currency: 'USD',
    },
  });

test('posts one balanced transfer and updates cached balances', async () => {
  const response = await transfer('transfer-success-001');
  expect(response.statusCode).toBe(201);
  const body = JSON.parse(response.body) as { id: string; amount: string; status: string };
  expect(body).toMatchObject({ amount: '250.00', status: 'completed' });

  const balances = await pool.query<{ id: string; balance_minor: string }>(
    'SELECT id, balance_minor FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id',
    [[sourceId, destinationId]],
  );
  const byId = new Map(balances.rows.map((row) => [row.id, row.balance_minor]));
  expect(byId.get(sourceId)).toBe('75000');
  expect(byId.get(destinationId)).toBe('25000');

  const postings = await pool.query<{ total: string; count: string }>(
    `SELECT sum(p.amount_minor)::text AS total, count(*)::text AS count
     FROM postings p JOIN transfers t ON t.journal_transaction_id = p.journal_transaction_id
     WHERE t.id = $1`,
    [body.id],
  );
  expect(postings.rows[0]).toEqual({ total: '0', count: '2' });
});

test('replays the stored response without another transfer', async () => {
  const first = await transfer('transfer-replay-001', '100.00');
  const second = await transfer('transfer-replay-001', '100.00');
  expect(first.statusCode).toBe(201);
  expect(second.statusCode).toBe(200);
  expect(second.headers['idempotent-replayed']).toBe('true');
  expect(JSON.parse(second.body)).toEqual(JSON.parse(first.body));
});

test('serializes concurrent requests with the same idempotency key', async () => {
  const before = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM transfers',
  );
  const responses = await Promise.all([
    transfer('transfer-concurrent-replay-001', '25.00'),
    transfer('transfer-concurrent-replay-001', '25.00'),
  ]);
  expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 201]);
  expect(JSON.parse(responses[0].body)).toEqual(JSON.parse(responses[1].body));
  const after = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM transfers',
  );
  expect(BigInt(after.rows[0]?.count ?? '0') - BigInt(before.rows[0]?.count ?? '0')).toBe(1n);
});

test('rejects reuse of a key with a different request', async () => {
  await transfer('transfer-conflict-001', '50.00');
  const response = await transfer('transfer-conflict-001', '51.00');
  expect(response.statusCode).toBe(409);
  expect(JSON.parse(response.body)).toMatchObject({ code: 'idempotency_conflict' });
});

test('rolls back insufficient funds without ledger entries', async () => {
  const before = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM transfers',
  );
  const response = await transfer('transfer-insufficient-001', '999999.00');
  expect(response.statusCode).toBe(422);
  expect(JSON.parse(response.body)).toMatchObject({ code: 'insufficient_funds' });
  const after = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM transfers',
  );
  expect(after.rows[0]).toEqual(before.rows[0]);
});

test('rolls back every financial record when posting insertion fails', async () => {
  await pool.query(`
    CREATE FUNCTION fail_test_posting() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'injected posting failure';
    END;
    $$;
    CREATE TRIGGER fail_test_posting
      BEFORE INSERT ON postings
      FOR EACH ROW EXECUTE FUNCTION fail_test_posting();
  `);
  const before = await pool.query<{ transfers: string; journals: string; postings: string }>(`
    SELECT
      (SELECT count(*)::text FROM transfers) AS transfers,
      (SELECT count(*)::text FROM journal_transactions) AS journals,
      (SELECT count(*)::text FROM postings) AS postings
  `);
  try {
    const response = await transfer('injected-posting-failure', '10.00');
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toMatchObject({ code: 'internal_error' });
  } finally {
    await pool.query(`
      DROP TRIGGER fail_test_posting ON postings;
      DROP FUNCTION fail_test_posting();
    `);
  }
  const after = await pool.query<{ transfers: string; journals: string; postings: string }>(`
    SELECT
      (SELECT count(*)::text FROM transfers) AS transfers,
      (SELECT count(*)::text FROM journal_transactions) AS journals,
      (SELECT count(*)::text FROM postings) AS postings
  `);
  expect(after.rows[0]).toEqual(before.rows[0]);
  const idempotency = await pool.query(
    "SELECT 1 FROM idempotency_records WHERE key = 'injected-posting-failure'",
  );
  expect(idempotency.rowCount).toBe(0);
});

test('rejects zero and excessive amounts as client errors', async () => {
  for (const amount of ['0', '0.00', '92233720368547758.08']) {
    const response = await transfer(`invalid-amount-${amount}`, amount);
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toMatchObject({ code: 'invalid_amount' });
  }
});

test('rejects transfers for a suspended tenant', async () => {
  await pool.query("UPDATE tenants SET status = 'suspended' WHERE id = $1", [tenantId]);
  try {
    const response = await transfer('suspended-tenant-transfer', '10.00');
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({ code: 'tenant_suspended' });
  } finally {
    await pool.query("UPDATE tenants SET status = 'active' WHERE id = $1", [tenantId]);
  }
});

test('rejects system accounts in customer initiated transfers', async () => {
  for (const accountId of [sourceId, destinationId]) {
    await pool.query("UPDATE accounts SET kind = 'system' WHERE id = $1", [accountId]);
    try {
      const response = await transfer(`system-account-${accountId}`, '10.00');
      expect(response.statusCode).toBe(422);
      expect(JSON.parse(response.body)).toMatchObject({ code: 'system_account_restricted' });
    } finally {
      await pool.query("UPDATE accounts SET kind = 'customer' WHERE id = $1", [accountId]);
    }
  }
});
