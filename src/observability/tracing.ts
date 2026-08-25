import {
  SpanKind,
  SpanStatusCode,
  context,
  isSpanContextValid,
  trace,
  type Attributes,
  type Context,
  type Span,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { FastifyInstance } from 'fastify';

export interface TracingOptions {
  endpoint?: string;
  spanProcessors?: SpanProcessor[];
}

const traceEndpoint = (base: string): string =>
  base.endsWith('/v1/traces') ? base : `${base.replace(/\/$/, '')}/v1/traces`;

export const initializeTracing = (options: TracingOptions): NodeSDK => {
  const sdk = new NodeSDK({
    serviceName: 'supercool-ledger',
    ...(options.spanProcessors
      ? { spanProcessors: options.spanProcessors }
      : options.endpoint
        ? { traceExporter: new OTLPTraceExporter({ url: traceEndpoint(options.endpoint) }) }
        : {}),
  });
  sdk.start();
  return sdk;
};

export const registerTracing = (app: FastifyInstance): void => {
  app.addHook('onRequest', (request, _reply, done) => {
    request.serviceSpan = trace.getTracer('supercool-ledger').startSpan('http.request', {
      kind: SpanKind.SERVER,
      attributes: { 'http.request.method': request.method },
    });
    request.serviceContext = trace.setSpan(context.active(), request.serviceSpan);
    const spanContext = request.serviceSpan.spanContext();
    request.traceId = isSpanContextValid(spanContext) ? spanContext.traceId : undefined;
    done();
  });
  app.addHook('onResponse', (request, reply, done) => {
    request.serviceSpan.setAttributes({
      'http.route': request.routeOptions.url ?? 'unmatched',
      'http.response.status_code': reply.statusCode,
    });
    if (reply.statusCode >= 500) request.serviceSpan.setStatus({ code: SpanStatusCode.ERROR });
    request.serviceSpan.end();
    done();
  });
};

export const withSpan = async <T>(
  name: string,
  attributes: Attributes,
  operation: () => Promise<T>,
  parentContext: Context = context.active(),
): Promise<T> =>
  trace
    .getTracer('supercool-ledger')
    .startActiveSpan(name, { attributes }, parentContext, async (span) => {
      try {
        return await operation();
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });

declare module 'fastify' {
  interface FastifyRequest {
    serviceSpan: Span;
    serviceContext: Context;
    traceId: string | undefined;
  }
}
