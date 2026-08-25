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
    "INSERT INTO tenants (name) VALUES ('Frutella Finance') RETURNING id",
  );
  const row = tenant.rows[0];
  if (!row) throw new Error('tenant_fixture_failed');
  tenantId = row.id;
  token = await signDevelopmentToken(
    {
      subject: 'reviewer',
      tenantId: row.id,
      scopes: ['accounts:read', 'accounts:write'],
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

test('creates and reads a zero balance account', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/v1/accounts',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'Operating USD', currency: 'USD' },
  });
  expect(created.statusCode).toBe(201);
  const account = JSON.parse(created.body) as { id: string; balance: string; currency: string };
  expect(account).toMatchObject({ balance: '0.00', currency: 'USD' });

  const read = await app.inject({
    method: 'GET',
    url: `/v1/accounts/${account.id}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(read.statusCode).toBe(200);
  expect(JSON.parse(read.body)).toEqual(account);
});

test('requires authentication', async () => {
  const response = await app.inject({ method: 'POST', url: '/v1/accounts', payload: {} });
  expect(response.statusCode).toBe(401);
});

test('lists immutable ledger entries for an account', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/v1/accounts',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'Statement USD', currency: 'USD' },
  });
  const account = JSON.parse(created.body) as { id: string };
  await fundAccount(pool, tenantId, account.id, 'USD', 12_345n);

  const response = await app.inject({
    method: 'GET',
    url: `/v1/accounts/${account.id}/entries?limit=10`,
    headers: { authorization: `Bearer ${token}` },
  });

  expect(response.statusCode).toBe(200);
  expect(JSON.parse(response.body)).toMatchObject({
    entries: [
      {
        accountId: account.id,
        amount: '123.45',
        currency: 'USD',
        journalKind: 'opening',
      },
    ],
    nextCursor: null,
  });
});
