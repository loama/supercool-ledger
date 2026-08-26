import type { PoolClient } from 'pg';
import type { Database } from '../platform/database.ts';

export interface DemoSeed {
  tenantId: string;
  sourceAccountId: string;
  destinationAccountId: string;
}

export const seedDemoTenant = async (
  client: PoolClient,
  tenantName = 'Frutella Company',
  sandbox = false,
): Promise<DemoSeed> => {
  const tenant = sandbox
    ? await client.query<{ id: string }>('SELECT create_sandbox_tenant($1) AS id', [tenantName])
    : await client.query<{ id: string }>('INSERT INTO tenants (name) VALUES ($1) RETURNING id', [
        tenantName,
      ]);
  const tenantRow = tenant.rows[0];
  if (!tenantRow) throw new Error('demo_tenant_failed');
  const accounts = await client.query<{ id: string; kind: string }>(
    `INSERT INTO accounts (tenant_id, name, currency, kind)
       VALUES
         ($1, 'Operating USD', 'USD', 'customer'),
         ($1, 'Supplier Reserve', 'USD', 'customer'),
         ($1, 'System Treasury', 'USD', 'system')
       RETURNING id, kind`,
    [tenantRow.id],
  );
  const customerAccounts = accounts.rows.filter((row) => row.kind === 'customer');
  const treasury = accounts.rows.find((row) => row.kind === 'system');
  const source = customerAccounts[0];
  const destination = customerAccounts[1];
  if (!source || !destination || !treasury) throw new Error('demo_accounts_failed');
  const journal = await client.query<{ id: string }>(
    `INSERT INTO journal_transactions (tenant_id, kind, reference)
       VALUES ($1, 'opening', 'demo opening balance') RETURNING id`,
    [tenantRow.id],
  );
  const journalRow = journal.rows[0];
  if (!journalRow) throw new Error('demo_journal_failed');
  await client.query(
    `INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor)
       VALUES ($1, $2, 'USD', 100000), ($1, $3, 'USD', -100000)`,
    [journalRow.id, source.id, treasury.id],
  );
  await client.query(
    `UPDATE accounts SET balance_minor = CASE
         WHEN id = $1 THEN 100000
         WHEN id = $2 THEN -100000
       END WHERE id = ANY($3::uuid[])`,
    [source.id, treasury.id, [source.id, treasury.id]],
  );
  return {
    tenantId: tenantRow.id,
    sourceAccountId: source.id,
    destinationAccountId: destination.id,
  };
};

export const seedDemo = async (database: Database): Promise<DemoSeed> =>
  database.transaction((client) => seedDemoTenant(client));
