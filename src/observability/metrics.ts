import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { Counter, Histogram, Registry } from 'prom-client';

export interface ServiceMetrics {
  registry: Registry;
  httpRequests: Counter<'method' | 'route' | 'status_class'>;
  httpDuration: Histogram<'method' | 'route' | 'status_class'>;
  transfers: Counter<'outcome'>;
  idempotency: Counter<'decision'>;
  reconciliation: Counter<'outcome'>;
}

declare module 'fastify' {
  interface FastifyInstance {
    serviceMetrics: ServiceMetrics;
  }
}

export const createMetrics = (): ServiceMetrics => {
  const registry = new Registry();
  return {
    registry,
    httpRequests: new Counter({
      name: 'supercool_http_requests_total',
      help: 'Completed HTTP requests',
      labelNames: ['method', 'route', 'status_class'],
      registers: [registry],
    }),
    httpDuration: new Histogram({
      name: 'supercool_http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status_class'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [registry],
    }),
    transfers: new Counter({
      name: 'supercool_transfers_total',
      help: 'Transfer attempts by outcome',
      labelNames: ['outcome'],
      registers: [registry],
    }),
    idempotency: new Counter({
      name: 'supercool_idempotency_total',
      help: 'Idempotency decisions',
      labelNames: ['decision'],
      registers: [registry],
    }),
    reconciliation: new Counter({
      name: 'supercool_reconciliation_total',
      help: 'Reconciliation runs',
      labelNames: ['outcome'],
      registers: [registry],
    }),
  };
};

export const registerMetrics = (app: FastifyInstance, token?: string): void => {
  const metrics = createMetrics();
  app.decorate('serviceMetrics', metrics);

  app.addHook('onRequest', (request, _reply, done) => {
    request.startTime = process.hrtime.bigint();
    done();
  });
  app.addHook('onResponse', (request, reply, done) => {
    const route = request.routeOptions.url ?? 'unmatched';
    const statusClass = `${Math.floor(reply.statusCode / 100)}xx`;
    const labels = { method: request.method, route, status_class: statusClass };
    metrics.httpRequests.inc(labels);
    const elapsed = Number(process.hrtime.bigint() - request.startTime) / 1_000_000_000;
    metrics.httpDuration.observe(labels, elapsed);
    request.log.info(
      {
        request_id: request.id,
        ...(request.traceId ? { trace_id: request.traceId } : {}),
        method: request.method,
        route,
        status_code: reply.statusCode,
        duration_ms: Number((elapsed * 1000).toFixed(3)),
      },
      'request completed',
    );
    done();
  });

  if (token) {
    app.get(
      '/metrics',
      {
        schema: {
          tags: ['Operations'],
          security: [{ metricsAuth: [] }],
          response: {
            200: Type.String(),
            401: Type.Object({ status: Type.Literal('unauthorized') }),
          },
        },
      },
      async (request, reply) => {
        if (request.headers.authorization !== `Bearer ${token}`) {
          return reply.status(401).send({ status: 'unauthorized' });
        }
        return reply.type(metrics.registry.contentType).send(await metrics.registry.metrics());
      },
    );
  }
};

declare module 'fastify' {
  interface FastifyRequest {
    startTime: bigint;
  }
}
