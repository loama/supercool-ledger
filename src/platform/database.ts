import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

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
  const pool = new Pool({ connectionString, max: 20, idleTimeoutMillis: 30_000 });
  return {
    pool,
    close: async () => pool.end(),
    ping: async () => {
      const table = await pool.query<{ relation: string | null }>(
        "SELECT to_regclass('public.schema_migrations')::text AS relation",
      );
      if (!table.rows[0]?.relation) throw new Error('database_schema_not_ready');
      const migration = await pool.query(
        "SELECT 1 FROM schema_migrations WHERE name = '002_harden_ledger_boundaries.sql'",
      );
      if (!migration.rowCount) throw new Error('database_schema_not_ready');
    },
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
