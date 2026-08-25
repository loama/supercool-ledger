import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import { signDevelopmentToken } from '../../src/auth/token.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';

const authSecret = 'a-development-secret-with-more-than-32-characters';
let app: FastifyInstance;
let database: Database;
let pool: Pool;
let token: string;

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
    "INSERT INTO tenants (name) VALUES ('Operations Test') RETURNING id",
  );
  const tenantId = tenant.rows[0]?.id;
  if (!tenantId) throw new Error('tenant_fixture_failed');
  token = await signDevelopmentToken(
    { subject: 'operator', tenantId, scopes: ['operations:read'] },
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

test('runs reconciliation and records the clean outcome', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/v1/operations/reconciliation',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.statusCode).toBe(200);
  expect(JSON.parse(response.body)).toEqual({ checkedAccounts: 0, discrepancies: [] });

  const metrics = await app.inject({
    method: 'GET',
    url: '/metrics',
    headers: { authorization: 'Bearer metrics-test-token' },
  });
  expect(metrics.body).toContain('supercool_reconciliation_total{outcome="clean"} 1');
});
