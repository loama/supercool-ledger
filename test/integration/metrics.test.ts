import { afterAll, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import { signDevelopmentToken } from '../../src/auth/token.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';
import { fundAccount } from '../helpers/ledger.ts';

let app: FastifyInstance;
let pool: Pool | undefined;
let database: Database | undefined;

afterAll(async () => {
  await app.close();
  await database?.close();
  await pool?.end();
});

test('protects metrics and accepts both tokens during rotation', async () => {
  app = await buildApp({
    database: null,
    metricsToken: 'metrics-test-token',
    metricsTokenSecondary: 'metrics-secondary-token',
  });
  await app.inject({ method: 'GET', url: '/health/live' });

  const denied = await app.inject({ method: 'GET', url: '/metrics' });
  expect(denied.statusCode).toBe(401);

  const allowed = await app.inject({
    method: 'GET',
    url: '/metrics',
    headers: { authorization: 'Bearer metrics-test-token' },
  });
  expect(allowed.statusCode).toBe(200);
  expect(allowed.body).toContain('supercool_http_requests_total');
  expect(allowed.body).toContain('route="/health/live"');
  expect(allowed.body).not.toContain('x-request-id');

  const secondary = await app.inject({
    method: 'GET',
    url: '/metrics',
    headers: { authorization: 'Bearer metrics-secondary-token' },
  });
  expect(secondary.statusCode).toBe(200);
});

test('records bounded financial outcome metrics', async () => {
  await app.close();
  pool = createTestPool();
  const client = await pool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
  await migrate(pool);
  const tenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Metrics Test') RETURNING id",
  );
  const tenantId = tenant.rows[0]?.id;
  if (!tenantId) throw new Error('tenant_fixture_failed');
  const accounts = await pool.query<{ id: string }>(
    `INSERT INTO accounts (tenant_id, name, currency)
     VALUES ($1, 'Source', 'USD'), ($1, 'Destination', 'USD') RETURNING id`,
    [tenantId],
  );
  const sourceId = accounts.rows[0]?.id;
  const destinationId = accounts.rows[1]?.id;
  if (!sourceId || !destinationId) throw new Error('account_fixture_failed');
  await fundAccount(pool, tenantId, sourceId, 'USD', 10_000n);
  const token = await signDevelopmentToken(
    {
      subject: 'reviewer',
      tenantId,
      scopes: ['transfers:write'],
    },
    'a-development-secret-with-more-than-32-characters',
  );
  database = createDatabase(testDatabaseUrl);
  app = await buildApp({
    database,
    authSecret: 'a-development-secret-with-more-than-32-characters',
    metricsToken: 'metrics-test-token',
  });
  const payload = { sourceAccountId: sourceId, destinationAccountId: destinationId };
  const send = (key: string, amount: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/transfers',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
      payload: { ...payload, amount, currency: 'USD' },
    });

  await send('metrics-success-key', '10.00');
  await send('metrics-success-key', '10.00');
  await send('metrics-success-key', '11.00');
  await send('metrics-insufficient-key', '999.00');

  const response = await app.inject({
    method: 'GET',
    url: '/metrics',
    headers: { authorization: 'Bearer metrics-test-token' },
  });
  expect(response.body).toContain('supercool_transfers_total{outcome="completed"} 1');
  expect(response.body).toContain('supercool_transfers_total{outcome="rejected"} 2');
  expect(response.body).toContain('supercool_idempotency_total{decision="claimed"} 2');
  expect(response.body).toContain('supercool_idempotency_total{decision="replayed"} 1');
  expect(response.body).toContain('supercool_idempotency_total{decision="conflict"} 1');
});
