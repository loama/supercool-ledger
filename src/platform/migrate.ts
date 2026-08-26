import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const migrationDirectory = fileURLToPath(new URL('../../migrations/', import.meta.url));

const migrationFiles = async (): Promise<string[]> =>
  (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();

const checksum = (sql: string): string => createHash('sha256').update(sql).digest('hex');

export const assertMigrationsApplied = async (pool: Pool): Promise<void> => {
  const table = await pool.query<{ relation: string | null }>(
    "SELECT to_regclass('public.schema_migrations')::text AS relation",
  );
  if (!table.rows[0]?.relation) throw new Error('database_schema_not_ready');
  const expected = await migrationFiles();
  const applied = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.rows.map((row) => row.name));
  if (expected.some((name) => !appliedNames.has(name))) {
    throw new Error('database_schema_not_ready');
  }
};

export const migrate = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('supercool-ledger-migrations'))");
    await client.query("SELECT set_config('app.reviewed_sandbox_tenant_ids', $1, false)", [
      process.env.REVIEWED_SANDBOX_TENANT_IDS ?? '',
    ]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum CHAR(64),
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum CHAR(64)');

    const names = await migrationFiles();
    for (const name of names) {
      const sql = await Bun.file(`${migrationDirectory}/${name}`).text();
      const digest = checksum(sql);
      const applied = await client.query<{ checksum: string | null }>(
        'SELECT checksum FROM schema_migrations WHERE name = $1',
        [name],
      );
      const existing = applied.rows[0];
      if (existing) {
        if (existing.checksum === null) {
          await client.query('UPDATE schema_migrations SET checksum = $2 WHERE name = $1', [
            name,
            digest,
          ]);
          continue;
        }
        if (existing.checksum !== digest) {
          throw new Error(`migration_checksum_mismatch:${name}`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          name,
          digest,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('supercool-ledger-migrations'))")
      .catch(() => undefined);
    client.release();
  }
};
