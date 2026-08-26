import { Pool } from 'pg';
import { migrate } from '../src/platform/migrate.ts';
import { provisionRuntimeRole } from '../src/platform/runtime-role.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('missing_environment:DATABASE_URL');

const pool = new Pool({ connectionString: databaseUrl });
try {
  await migrate(pool);
  const runtimeUsername = process.env.APPLICATION_DATABASE_USERNAME;
  const runtimePassword = process.env.APPLICATION_DATABASE_PASSWORD;
  if (runtimeUsername || runtimePassword) {
    if (!runtimeUsername || !runtimePassword) {
      throw new Error('missing_environment:APPLICATION_DATABASE_CREDENTIALS');
    }
    await provisionRuntimeRole(pool, {
      username: runtimeUsername,
      password: runtimePassword,
    });
  }
} finally {
  await pool.end();
}
