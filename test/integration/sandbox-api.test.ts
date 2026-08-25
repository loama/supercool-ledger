import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';

const authSecret = 'a-development-secret-with-more-than-32-characters';
let app: FastifyInstance;
let disabledApp: FastifyInstance;
let database: Database;
let pool: Pool;

interface SandboxResponse {
  tenantId: string;
  token: string;
  expiresAt: string;
  accounts: Array<{
    id: string;
    name: string;
    currency: string;
    balance: string;
  }>;
}

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
  app = await buildApp({
    database,
    authSecret,
    metricsToken: 'metrics-test-token',
    sandboxEnabled: true,
  });
  disabledApp = await buildApp({
    database,
    authSecret,
    metricsToken: 'metrics-test-token',
    sandboxEnabled: false,
  });
});

afterAll(async () => {
  await app.close();
  await disabledApp.close();
  await database.close();
  await pool.end();
});

test('keeps sandbox session creation absent when disabled', async () => {
  const response = await disabledApp.inject({ method: 'POST', url: '/v1/sandbox/sessions' });
  expect(response.statusCode).toBe(404);
});

test('creates a no store session without exposing the signing secret', async () => {
  const response = await app.inject({ method: 'POST', url: '/v1/sandbox/sessions' });

  expect(response.statusCode).toBe(201);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-type']).toContain('application/json');
  expect(response.body).not.toContain(authSecret);

  const body = JSON.parse(response.body) as SandboxResponse;
  expect(body.accounts).toHaveLength(2);
  expect(body.token.split('.')).toHaveLength(3);
});

test('uses the returned token for its own accounts and hides another sandbox', async () => {
  const first = JSON.parse(
    (await app.inject({ method: 'POST', url: '/v1/sandbox/sessions' })).body,
  ) as SandboxResponse;
  const second = JSON.parse(
    (await app.inject({ method: 'POST', url: '/v1/sandbox/sessions' })).body,
  ) as SandboxResponse;

  const own = await app.inject({
    method: 'GET',
    url: `/v1/accounts/${first.accounts[0]?.id}`,
    headers: { authorization: `Bearer ${first.token}` },
  });
  const foreign = await app.inject({
    method: 'GET',
    url: `/v1/accounts/${second.accounts[0]?.id}`,
    headers: { authorization: `Bearer ${first.token}` },
  });

  expect(own.statusCode).toBe(200);
  expect(JSON.parse(own.body)).toMatchObject({ id: first.accounts[0]?.id, balance: '1000.00' });
  expect(foreign.statusCode).toBe(404);
});
