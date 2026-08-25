import { mkdir } from 'node:fs/promises';
import { createDatabase } from '../src/platform/database.ts';
import { migrate } from '../src/platform/migrate.ts';
import { runDemo } from '../src/demo/run.ts';

const databaseUrl = process.env.DATABASE_URL;
const authSecret = process.env.AUTH_SECRET;
if (!databaseUrl) throw new Error('missing_environment:DATABASE_URL');
if (!authSecret) throw new Error('missing_environment:AUTH_SECRET');

const database = createDatabase(databaseUrl);
try {
  await migrate(database.pool);
  const result = await runDemo(database, authSecret);
  await mkdir('video/assets', { recursive: true });
  await Bun.write('video/assets/demo-run.json', `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write('video/assets/demo-run.json\n');
} finally {
  await database.close();
}
