import { Pool } from 'pg';
import { migrate } from '../src/platform/migrate.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('missing_environment:DATABASE_URL');

const pool = new Pool({ connectionString: databaseUrl });
try {
  await migrate(pool);
} finally {
  await pool.end();
}
