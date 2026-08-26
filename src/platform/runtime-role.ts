import type { Pool, QueryResultRow } from 'pg';

interface RoleRow extends QueryResultRow {
  exists: boolean;
}

interface DatabaseRow extends QueryResultRow {
  database_name: string;
}

export interface RuntimeRoleOptions {
  password: string;
  username: string;
}

const validateIdentifier = (value: string): string => {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error('invalid_runtime_database_username');
  }
  return value;
};

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

export const provisionRuntimeRole = async (
  pool: Pool,
  options: RuntimeRoleOptions,
): Promise<void> => {
  const username = validateIdentifier(options.username);
  if (options.password.length < 20) throw new Error('runtime_database_password_too_short');
  const role = quoteIdentifier(username);
  const password = quoteLiteral(options.password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('supercool-ledger-runtime-role'))");
    const existing = await client.query<RoleRow>(
      'SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists',
      [username],
    );
    if (existing.rows[0]?.exists) {
      await client.query(
        `ALTER ROLE ${role} WITH LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
      );
    } else {
      await client.query(
        `CREATE ROLE ${role} WITH LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
      );
    }

    const database = await client.query<DatabaseRow>(
      'SELECT current_database()::text AS database_name',
    );
    const databaseName = database.rows[0]?.database_name;
    if (!databaseName) throw new Error('runtime_database_name_missing');
    const quotedDatabase = quoteIdentifier(databaseName);

    await client.query(`REVOKE ALL ON DATABASE ${quotedDatabase} FROM ${role}`);
    await client.query(`GRANT CONNECT ON DATABASE ${quotedDatabase} TO ${role}`);
    await client.query(`REVOKE ALL ON SCHEMA public FROM ${role}`);
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role}`);
    await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${role}`);
    await client.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${role}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await client.query(`
      GRANT SELECT, INSERT ON TABLE tenants TO ${role};
      GRANT SELECT, INSERT, UPDATE ON TABLE accounts TO ${role};
      GRANT SELECT, INSERT ON TABLE journal_transactions TO ${role};
      GRANT SELECT, INSERT ON TABLE postings TO ${role};
      GRANT SELECT, INSERT ON TABLE transfers TO ${role};
      GRANT SELECT, INSERT, UPDATE ON TABLE idempotency_records TO ${role};
      GRANT SELECT, INSERT ON TABLE audit_events TO ${role};
      GRANT SELECT, INSERT ON TABLE sandbox_sessions TO ${role};
      GRANT SELECT ON TABLE schema_migrations TO ${role};
      GRANT EXECUTE ON FUNCTION lock_runtime_tenant_status(UUID) TO ${role};
      GRANT EXECUTE ON FUNCTION purge_expired_sandbox_tenants() TO ${role};
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
