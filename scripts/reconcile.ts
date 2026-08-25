import { createDatabase } from '../src/platform/database.ts';
import { reconcile } from '../src/reconciliation/service.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('missing_environment:DATABASE_URL');

const database = createDatabase(databaseUrl);
try {
  const result = await reconcile(database);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.discrepancies.length > 0) process.exitCode = 1;
} finally {
  await database.close();
}
