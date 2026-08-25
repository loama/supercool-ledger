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

test('rejects a negative cached balance', async () => {
  const { accountId } = await fixture();
  await expectErrorCode(
    pool.query('UPDATE accounts SET balance_minor = -1 WHERE id = $1', [accountId]),
    '23514',
  );
});
