import { expect, test } from 'bun:test';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { buildApp } from '../../src/app.ts';
import { initializeTracing, withSpan } from '../../src/observability/tracing.ts';

test('exports a financial operation span without financial identifiers', async () => {
  const exporter = new InMemorySpanExporter();
  const sdk = initializeTracing({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  await withSpan('ledger.transfer.create', { 'financial.operation': 'transfer' }, () =>
    Promise.resolve(42),
  );
  const app = await buildApp({ database: null });
  await app.inject({ method: 'GET', url: '/health/live' });
  for (let attempt = 0; attempt < 20 && exporter.getFinishedSpans().length < 2; attempt += 1) {
    await Bun.sleep(10);
  }

  const spans = exporter.getFinishedSpans();
  expect(spans.map((span) => span.name)).toEqual(['ledger.transfer.create', 'http.request']);
  expect(spans[0]?.attributes).toEqual({ 'financial.operation': 'transfer' });
  expect(spans[1]?.attributes).toMatchObject({
    'http.request.method': 'GET',
    'http.response.status_code': 200,
    'http.route': '/health/live',
  });
  await app.close();
  await sdk.shutdown();
});
