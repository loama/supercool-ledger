import { afterAll, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.ts';

let app: FastifyInstance;

afterAll(async () => {
  await app.close();
});

test('protects metrics and exposes bounded labels', async () => {
  app = await buildApp({ database: null, metricsToken: 'metrics-test-token' });
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
});
