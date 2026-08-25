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
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await database.close();
}
