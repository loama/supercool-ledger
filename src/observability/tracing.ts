import { SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';

const tracer = trace.getTracer('supercool-ledger');

export const withSpan = async <T>(
  name: string,
  attributes: Attributes,
  operation: () => Promise<T>,
): Promise<T> =>
  tracer.startActiveSpan(name, { attributes }, async (span) => {
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
