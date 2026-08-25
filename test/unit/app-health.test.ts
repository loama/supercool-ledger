import { afterEach, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.ts';
import type { Database } from '../../src/platform/database.ts';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

test('reports liveness without a database dependency', async () => {
  app = await buildApp({ database: null });
  const response = await app.inject({ method: 'GET', url: '/health/live' });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body) as { status: string };
  expect(body).toEqual({ status: 'alive' });
});

test('reports not ready when the database check fails', async () => {
  const database = {
    ping: () => Promise.reject(new Error('database unavailable')),
  } as Database;
  app = await buildApp({
    database,
    authSecret: 'a-development-secret-with-more-than-32-characters',
    metricsToken: 'metrics-test-token',
  });
  const response = await app.inject({ method: 'GET', url: '/health/ready' });
  expect(response.statusCode).toBe(503);
  expect(JSON.parse(response.body)).toEqual({ status: 'not_ready' });
});
