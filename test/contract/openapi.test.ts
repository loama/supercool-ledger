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
    paths: Record<string, { post?: { requestBody?: unknown; responses?: unknown } }>;
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
  expect(JSON.stringify(document.paths['/v1/accounts']?.post?.requestBody)).toContain(
    'Operating USD',
  );
  expect(JSON.stringify(document.paths['/v1/transfers']?.post?.requestBody)).toContain('250.00');
  expect(JSON.stringify(document.paths['/v1/transfers']?.post?.responses)).toContain(
    'insufficient_funds',
  );
  expect(JSON.stringify(document.paths['/v1/transfers']?.post?.responses)).toContain(
    'authentication_required',
  );
  expect(JSON.stringify(document.paths['/metrics'])).toContain('metricsAuth');

  const docs = await app.inject({ method: 'GET', url: '/docs' });
  expect(docs.statusCode).toBe(301);
  expect(docs.headers.location).toBe('/docs/');
  const docsPage = await app.inject({ method: 'GET', url: '/docs/' });
  expect(docsPage.statusCode).toBe(200);
  expect(docsPage.body).toContain('scalar');
  for (const path of ['/docs/../package.json', '/docs/%2e%2e/package.json']) {
    const traversal = await app.inject({ method: 'GET', url: path });
    expect(traversal.statusCode).not.toBe(200);
    expect(traversal.body).not.toContain('supercool-ledger');
  }
});
