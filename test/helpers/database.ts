import { Pool, type PoolClient } from 'pg';

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://supercool:supercool@127.0.0.1:54329/supercool';

export const createTestPool = (): Pool => new Pool({ connectionString: testDatabaseUrl, max: 20 });

export const resetDatabase = async (client: PoolClient): Promise<void> => {
  await client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
  `);
};
