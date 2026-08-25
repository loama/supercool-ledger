import { expect, test } from 'bun:test';
import { Writable } from 'node:stream';
import { createLogger } from '../../src/observability/logger.ts';

test('redacts financial and authentication fields', () => {
  let output = '';
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      output += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      callback();
    },
  });
  const logger = createLogger('info', stream);
  logger.info(
    {
      req: {
        headers: {
          authorization: 'Bearer secret-token',
          'idempotency-key': 'dangerous-key',
        },
      },
      body: { amount: '999.00' },
      balance: '1234.00',
      databaseUrl: 'postgres://secret',
    },
    'captured',
  );

  expect(output).not.toContain('secret-token');
  expect(output).not.toContain('dangerous-key');
  expect(output).not.toContain('999.00');
  expect(output).not.toContain('1234.00');
  expect(output).not.toContain('postgres://secret');
  expect(output).toContain('[Redacted]');
});
