import { expect, test } from 'bun:test';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import { signDevelopmentToken } from '../../src/auth/token.ts';
import type { Database } from '../../src/platform/database.ts';
import { initializeTracing, withSpan } from '../../src/observability/tracing.ts';

test('exports bounded financial spans and preserves their request parent', async () => {
  const exporter = new InMemorySpanExporter();
  const sdk = initializeTracing({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  await withSpan('ledger.transfer.create', { 'financial.operation': 'transfer' }, () =>
    Promise.resolve(42),
  );
  const database = {
    pool: {} as Pool,
    close: () => Promise.resolve(),
    ping: () => Promise.resolve(),
    query: () => Promise.resolve({ rows: [], rowCount: 0 }),
    transaction: () => Promise.reject(new Error('unused')),
  } as unknown as Database;
  const secret = 'a-development-secret-with-more-than-32-characters';
  const token = await signDevelopmentToken(
    {
      subject: 'reviewer',
      tenantId: '71fd79ad-072a-4695-8679-6bec2f44b28b',
      scopes: ['operations:read'],
    },
    secret,
  );
  const app = await buildApp({ database, authSecret: secret, metricsToken: 'metrics-test-token' });
  const response = await app.inject({
    method: 'GET',
    url: '/v1/operations/reconciliation',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.statusCode).toBe(200);
  await app.close();

  const spans = exporter.getFinishedSpans();
  const requestSpan = spans.find((span) => span.name === 'http.request');
  const operationSpan = exporter
    .getFinishedSpans()
    .find((span) => span.name === 'ledger.reconciliation.run');
  expect(requestSpan).toBeDefined();
  expect(operationSpan).toBeDefined();
  expect(operationSpan?.parentSpanContext?.spanId).toBe(requestSpan?.spanContext().spanId);
  const standalone = spans.find((span) => span.name === 'ledger.transfer.create');
  expect(standalone?.attributes).toEqual({ 'financial.operation': 'transfer' });
  expect(requestSpan?.attributes).toMatchObject({
    'http.request.method': 'GET',
    'http.response.status_code': 200,
    'http.route': '/v1/operations/reconciliation',
  });
  await sdk.shutdown();
});
