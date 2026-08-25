import { afterAll, expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';

let app: FastifyInstance;
let database: Database;

afterAll(async () => {
  await app.close();
  await database.close();
});

test('publishes the account and transfer contract', async () => {
  database = createDatabase('postgres://unused:unused@127.0.0.1:1/unused');
  app = await buildApp({
    database,
    authSecret: 'a-development-secret-with-more-than-32-characters',
    metricsToken: 'metrics-test-token',
  });
  const response = await app.inject({ method: 'GET', url: '/openapi.json' });
  expect(response.statusCode).toBe(200);
  const document = JSON.parse(response.body) as {
    info: { title: string };
    paths: Record<string, unknown>;
  };
  expect(document.info.title).toBe('SuperCool Ledger API');
  const paths = Object.keys(document.paths);
  for (const path of [
    '/v1/accounts',
    '/v1/accounts/{accountId}',
    '/v1/transfers',
    '/v1/transfers/{transferId}',
  ]) {
    expect(paths).toContain(path);
  }
});
