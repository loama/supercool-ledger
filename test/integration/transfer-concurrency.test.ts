import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import { signDevelopmentToken } from '../../src/auth/token.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';
import { fundAccount } from '../helpers/ledger.ts';

const secret = 'a-development-secret-with-more-than-32-characters';
let pool: Pool;
let database: Database;
let app: FastifyInstance;
let token: string;
let sourceId: string;
let firstDestinationId: string;
let secondDestinationId: string;

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
    "INSERT INTO tenants (name) VALUES ('Concurrency Test') RETURNING id",
  );
  const tenantRow = tenant.rows[0];
  if (!tenantRow) throw new Error('tenant_fixture_failed');
  const accounts = await pool.query<{ id: string }>(
    `INSERT INTO accounts (tenant_id, name, currency)
     VALUES ($1, 'Source', 'USD'), ($1, 'Destination A', 'USD'), ($1, 'Destination B', 'USD')
     RETURNING id`,
    [tenantRow.id],
  );
  const source = accounts.rows[0];
  const first = accounts.rows[1];
  const second = accounts.rows[2];
  if (!source || !first || !second) throw new Error('account_fixture_failed');
  sourceId = source.id;
  firstDestinationId = first.id;
  secondDestinationId = second.id;
  await fundAccount(pool, tenantRow.id, sourceId, 'USD', 10_000n);
  token = await signDevelopmentToken(
    { subject: 'race-reviewer', tenantId: tenantRow.id, scopes: ['transfers:write'] },
    secret,
  );
  database = createDatabase(testDatabaseUrl);
  app = await buildApp({ database, authSecret: secret, metricsToken: 'metrics-test-token' });
});

afterAll(async () => {
  await app.close();
  await database.close();
  await pool.end();
});

const request = (destinationAccountId: string, key: string) =>
  app.inject({
    method: 'POST',
    url: '/v1/transfers',
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    payload: {
      sourceAccountId: sourceId,
      destinationAccountId,
      amount: '80.00',
      currency: 'USD',
    },
  });

test('serializes competing transfers and prevents overspend', async () => {
  const responses = await Promise.all([
    request(firstDestinationId, 'concurrent-spend-a'),
    request(secondDestinationId, 'concurrent-spend-b'),
  ]);
  expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 422]);

  const balances = await pool.query<{ balance_minor: string }>(
    'SELECT balance_minor FROM accounts WHERE id = ANY($1::uuid[])',
    [[sourceId, firstDestinationId, secondDestinationId]],
  );
  const total = balances.rows.reduce((sum, row) => sum + BigInt(row.balance_minor), 0n);
  expect(total).toBe(10_000n);
  const source = await pool.query<{ balance_minor: string }>(
    'SELECT balance_minor FROM accounts WHERE id = $1',
    [sourceId],
  );
  expect(source.rows[0]?.balance_minor).toBe('2000');
});
