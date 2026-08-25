import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { assertMigrationsApplied } from './migrate.ts';

export interface Database {
  pool: Pool;
  close(): Promise<void>;
  ping(): Promise<void>;
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
  transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T>;
}

export const createDatabase = (connectionString: string): Database => {
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return {
    pool,
    close: async () => pool.end(),
    ping: async () => assertMigrationsApplied(pool),
    query: async <T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) =>
      pool.query<T>(text, values),
    transaction: async <T>(operation: (client: PoolClient) => Promise<T>) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const value = await operation(client);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
};
