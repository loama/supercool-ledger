import { buildApp } from './app.ts';
import { loadConfig } from './platform/config.ts';

const config = loadConfig(process.env);
const app = await buildApp({ database: null });

const close = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());

await app.listen({ host: config.host, port: config.port });
