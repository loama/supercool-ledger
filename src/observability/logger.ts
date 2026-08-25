import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

const redactedPaths = [
  'req.headers.authorization',
  'req.headers.idempotency-key',
  'headers.authorization',
  'headers.idempotency-key',
  'authorization',
  'idempotencyKey',
  'body',
  'balance',
  'amount',
  'accountName',
  'databaseUrl',
  'connectionString',
];

export const createLoggerOptions = (level = 'info'): LoggerOptions => ({
  level,
  base: { service: 'supercool-ledger' },
  redact: { paths: redactedPaths, censor: '[Redacted]' },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export const createLogger = (level = 'info', stream?: DestinationStream): Logger =>
  pino(createLoggerOptions(level), stream);
