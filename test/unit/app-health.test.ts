import { afterEach, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.ts';

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
