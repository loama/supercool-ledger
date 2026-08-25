import * as Sentry from '@sentry/node';
import { buildApp } from './app.ts';
import { loadConfig } from './platform/config.ts';
import { createDatabase } from './platform/database.ts';
import { initializeTracing } from './observability/tracing.ts';

const config = loadConfig(process.env);
if (config.sentryDsn) {
  Sentry.init({ dsn: config.sentryDsn, sendDefaultPii: false });
}
const tracing = config.otlpEndpoint ? initializeTracing({ endpoint: config.otlpEndpoint }) : null;
const database = createDatabase(config.databaseUrl);
const app = await buildApp({
  database,
  authSecret: config.authSecret,
  metricsToken: config.metricsToken,
  logLevel: config.logLevel,
});

const close = async (): Promise<void> => {
  await app.close();
  await database.close();
  await tracing?.shutdown();
  process.exit(0);
};

process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());

await app.listen({ host: config.host, port: config.port });
