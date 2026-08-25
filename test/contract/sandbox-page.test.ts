import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';

const authSecret = 'a-development-secret-with-more-than-32-characters';
let app: FastifyInstance;
let database: Database;
let pool: Pool;

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
});

afterAll(async () => {
  await app.close();
  await database.close();
  await pool.end();
});

test('serves the Spanish reviewer console with strict browser headers', async () => {
  const response = await app.inject({ method: 'GET', url: '/sandbox' });

  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('text/html');
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-security-policy']).toBe(
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  );
  expect(response.body).toContain('Sandbox de revisión');
  expect(response.body).toContain('Iniciar sandbox');
  expect(response.body).toContain('Transferencia válida');
  expect(response.body).toContain('Fondos insuficientes');
  expect(response.body).toContain('Conciliación');
  expect(response.body).toContain('/sandbox/styles.css');
  expect(response.body).toContain('/sandbox/app.js');
  expect(response.body).not.toContain(authSecret);
});

test('serves local assets without persistent browser token storage', async () => {
  const [styles, script] = await Promise.all([
    app.inject({ method: 'GET', url: '/sandbox/styles.css' }),
    app.inject({ method: 'GET', url: '/sandbox/app.js' }),
  ]);

  expect(styles.statusCode).toBe(200);
  expect(styles.headers['content-type']).toContain('text/css');
  expect(styles.body).toContain('@media (max-width: 760px)');
  expect(script.statusCode).toBe(200);
  expect(script.headers['content-type']).toContain('javascript');
  expect(script.body).toContain('/v1/sandbox/sessions');
  expect(script.body).toContain('/v1/transfers');
  expect(script.body).toContain('/v1/operations/reconciliation');
  expect(script.body).not.toContain('local' + 'Storage');
  expect(script.body).not.toContain('session' + 'Storage');
  expect(script.body).not.toContain(authSecret);
});
