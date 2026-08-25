import { afterAll, beforeEach, test } from 'bun:test';
import type { Pool } from 'pg';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase } from '../helpers/database.ts';
import { expectErrorCode } from '../helpers/errors.ts';

const pool: Pool = createTestPool();

beforeEach(async () => {
  const client = await pool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

const fixture = async (): Promise<{ accountId: string; journalId: string }> => {
  const tenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Constraint Test') RETURNING id",
  );
  const tenantRow = tenant.rows[0];
  if (!tenantRow) throw new Error('tenant_fixture_failed');
  const account = await pool.query<{ id: string }>(
    "INSERT INTO accounts (tenant_id, name, currency) VALUES ($1, 'Operating', 'USD') RETURNING id",
    [tenantRow.id],
  );
  const accountRow = account.rows[0];
  if (!accountRow) throw new Error('account_fixture_failed');
  const journal = await pool.query<{ id: string }>(
    "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'opening', 'fixture') RETURNING id",
    [tenantRow.id],
  );
  const journalRow = journal.rows[0];
  if (!journalRow) throw new Error('journal_fixture_failed');
  return { accountId: accountRow.id, journalId: journalRow.id };
};

test('rejects an unbalanced journal at commit', async () => {
  const { accountId, journalId } = await fixture();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor) VALUES ($1, $2, 'USD', 100)",
      [journalId, accountId],
    );
    await expectErrorCode(client.query('COMMIT'), '23000');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
});

test('rejects changes to posted ledger data', async () => {
  const { accountId, journalId } = await fixture();
  const second = await pool.query<{ id: string }>(
    "INSERT INTO accounts (tenant_id, name, currency) SELECT tenant_id, 'Treasury', 'USD' FROM accounts WHERE id = $1 RETURNING id",
    [accountId],
  );
  const secondRow = second.rows[0];
  if (!secondRow) throw new Error('second_account_fixture_failed');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor) VALUES ($1, $2, 'USD', 100), ($1, $3, 'USD', -100)",
      [journalId, accountId, secondRow.id],
    );
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  await expectErrorCode(
    pool.query('UPDATE postings SET amount_minor = 200 WHERE journal_transaction_id = $1', [
      journalId,
    ]),
    '23000',
  );
  await expectErrorCode(
    pool.query('DELETE FROM journal_transactions WHERE id = $1', [journalId]),
    '23000',
  );
});

test('rejects a transfer whose accounts belong to another tenant', async () => {
  const firstTenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Transfer Owner') RETURNING id",
  );
  const secondTenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Account Owner') RETURNING id",
  );
  const accounts = await pool.query<{ id: string }>(
    `INSERT INTO accounts (tenant_id, name, currency)
     VALUES ($1, 'Source', 'USD'), ($1, 'Destination', 'USD') RETURNING id`,
    [secondTenant.rows[0]?.id],
  );
  const journal = await pool.query<{ id: string }>(
    "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'transfer', 'invalid transfer') RETURNING id",
    [firstTenant.rows[0]?.id],
  );
  await expectErrorCode(
    pool.query(
      `INSERT INTO transfers
         (tenant_id, source_account_id, destination_account_id, currency, amount_minor, journal_transaction_id)
       VALUES ($1, $2, $3, 'USD', 100, $4)`,
      [firstTenant.rows[0]?.id, accounts.rows[0]?.id, accounts.rows[1]?.id, journal.rows[0]?.id],
    ),
    '23503',
  );
});

test('rejects a reversal of another tenant journal', async () => {
  const originalTenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Original Owner') RETURNING id",
  );
  const reversingTenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Reversing Owner') RETURNING id",
  );
  const original = await pool.query<{ id: string }>(
    "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'opening', 'original') RETURNING id",
    [originalTenant.rows[0]?.id],
  );
  await expectErrorCode(
    pool.query(
      `INSERT INTO journal_transactions
         (tenant_id, kind, reference, reverses_transaction_id)
       VALUES ($1, 'reversal', 'invalid reversal', $2)`,
      [reversingTenant.rows[0]?.id, original.rows[0]?.id],
    ),
    '23000',
  );
});

test('rejects a negative cached balance', async () => {
  const { accountId } = await fixture();
  await expectErrorCode(
    pool.query('UPDATE accounts SET balance_minor = -1 WHERE id = $1', [accountId]),
    '23514',
  );
});

test('rejects a posting for an account in another tenant', async () => {
  const { journalId } = await fixture();
  const otherTenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Other Tenant') RETURNING id",
  );
  const otherAccounts = await pool.query<{ id: string }>(
    `INSERT INTO accounts (tenant_id, name, currency)
     VALUES ($1, 'Other A', 'USD'), ($1, 'Other B', 'USD') RETURNING id`,
    [otherTenant.rows[0]?.id],
  );
  await expectErrorCode(
    pool.query(
      `INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor)
       VALUES ($1, $2, 'USD', 100), ($1, $3, 'USD', -100)`,
      [journalId, otherAccounts.rows[0]?.id, otherAccounts.rows[1]?.id],
    ),
    '23503',
  );
});

test('rejects a posting whose currency differs from the account', async () => {
  const { accountId, journalId } = await fixture();
  const second = await pool.query<{ id: string }>(
    "INSERT INTO accounts (tenant_id, name, currency) SELECT tenant_id, 'Second', 'USD' FROM accounts WHERE id = $1 RETURNING id",
    [accountId],
  );
  await expectErrorCode(
    pool.query(
      `INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor)
       VALUES ($1, $2, 'MXN', 100), ($1, $3, 'MXN', -100)`,
      [journalId, accountId, second.rows[0]?.id],
    ),
    '23503',
  );
});

test('rejects changes to audit history', async () => {
  const tenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Audit Tenant') RETURNING id",
  );
  const event = await pool.query<{ id: string }>(
    `INSERT INTO audit_events
       (tenant_id, actor_id, action, resource_type, request_id, outcome)
     VALUES ($1, 'reviewer', 'reconciliation.checked', 'tenant', 'request-1', 'clean')
     RETURNING id`,
    [tenant.rows[0]?.id],
  );
  await expectErrorCode(
    pool.query("UPDATE audit_events SET outcome = 'changed' WHERE id = $1", [event.rows[0]?.id]),
    '23000',
  );
  await expectErrorCode(
    pool.query('DELETE FROM audit_events WHERE id = $1', [event.rows[0]?.id]),
    '23000',
  );
});
