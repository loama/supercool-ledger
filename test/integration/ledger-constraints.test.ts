import { afterAll, beforeEach, test } from 'bun:test';
import type { Pool } from 'pg';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase } from '../helpers/database.ts';
import { expectErrorCode } from '../helpers/errors.ts';
import { fundAccount } from '../helpers/ledger.ts';

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

const tenantFixture = async (): Promise<{ tenantId: string; customerId: string }> => {
  const tenant = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Constraint Test') RETURNING id",
  );
  const tenantId = tenant.rows[0]?.id;
  if (!tenantId) throw new Error('tenant_fixture_failed');
  const account = await pool.query<{ id: string }>(
    "INSERT INTO accounts (tenant_id, name, currency) VALUES ($1, 'Operating', 'USD') RETURNING id",
    [tenantId],
  );
  const customerId = account.rows[0]?.id;
  if (!customerId) throw new Error('account_fixture_failed');
  return { tenantId, customerId };
};

test('rejects an unbalanced journal at commit', async () => {
  const { tenantId, customerId } = await tenantFixture();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const journal = await client.query<{ id: string }>(
      "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'opening', 'unbalanced') RETURNING id",
      [tenantId],
    );
    await client.query(
      "INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor) VALUES ($1, $2, 'USD', 100)",
      [journal.rows[0]?.id, customerId],
    );
    await expectErrorCode(client.query('COMMIT'), '23000');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
});

test('rejects an empty journal at commit', async () => {
  const { tenantId } = await tenantFixture();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'opening', 'empty')",
      [tenantId],
    );
    await expectErrorCode(client.query('COMMIT'), '23000');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
});

test('rejects changes to posted ledger data', async () => {
  const { tenantId, customerId } = await tenantFixture();
  const system = await pool.query<{ id: string }>(
    "INSERT INTO accounts (tenant_id, name, currency, kind) VALUES ($1, 'Treasury', 'USD', 'system') RETURNING id",
    [tenantId],
  );
  const systemId = system.rows[0]?.id;
  if (!systemId) throw new Error('system_account_fixture_failed');
  const client = await pool.connect();
  let journalId = '';
  try {
    await client.query('BEGIN');
    const journal = await client.query<{ id: string }>(
      "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'opening', 'fixture') RETURNING id",
      [tenantId],
    );
    journalId = journal.rows[0]?.id ?? '';
    await client.query(
      "INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor) VALUES ($1, $2, 'USD', 100), ($1, $3, 'USD', -100)",
      [journalId, customerId, systemId],
    );
    await client.query(
      'UPDATE accounts SET balance_minor = CASE WHEN id = $1 THEN 100 ELSE -100 END WHERE id = ANY($2::uuid[])',
      [customerId, [customerId, systemId]],
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

test('rejects a completed transfer whose postings do not match its amount', async () => {
  const { tenantId, customerId } = await tenantFixture();
  const system = await pool.query<{ id: string }>(
    "INSERT INTO accounts (tenant_id, name, currency, kind) VALUES ($1, 'System Source', 'USD', 'system') RETURNING id",
    [tenantId],
  );
  const systemId = system.rows[0]?.id;
  if (!systemId) throw new Error('system_account_fixture_failed');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const journal = await client.query<{ id: string }>(
      "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'transfer', 'wrong amount') RETURNING id",
      [tenantId],
    );
    const journalId = journal.rows[0]?.id;
    await client.query(
      "INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor) VALUES ($1, $2, 'USD', -50), ($1, $3, 'USD', 50)",
      [journalId, systemId, customerId],
    );
    await client.query(
      'UPDATE accounts SET balance_minor = CASE WHEN id = $1 THEN -50 ELSE 50 END WHERE id = ANY($2::uuid[])',
      [systemId, [systemId, customerId]],
    );
    await client.query(
      `INSERT INTO transfers
         (tenant_id, source_account_id, destination_account_id, currency, amount_minor, journal_transaction_id)
       VALUES ($1, $2, $3, 'USD', 100, $4)`,
      [tenantId, systemId, customerId, journalId],
    );
    await expectErrorCode(client.query('COMMIT'), '23000');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
});

test('rejects a transfer whose accounts belong to another tenant', async () => {
  const first = await tenantFixture();
  const second = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Account Owner') RETURNING id",
  );
  const accounts = await pool.query<{ id: string }>(
    `INSERT INTO accounts (tenant_id, name, currency)
     VALUES ($1, 'Source', 'USD'), ($1, 'Destination', 'USD') RETURNING id`,
    [second.rows[0]?.id],
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const journal = await client.query<{ id: string }>(
      "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'transfer', 'invalid transfer') RETURNING id",
      [first.tenantId],
    );
    await expectErrorCode(
      client.query(
        `INSERT INTO transfers
           (tenant_id, source_account_id, destination_account_id, currency, amount_minor, journal_transaction_id)
         VALUES ($1, $2, $3, 'USD', 100, $4)`,
        [first.tenantId, accounts.rows[0]?.id, accounts.rows[1]?.id, journal.rows[0]?.id],
      ),
      '23503',
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('rejects a reversal of another tenant journal', async () => {
  const original = await tenantFixture();
  await fundAccount(pool, original.tenantId, original.customerId, 'USD', 100n);
  const journal = await pool.query<{ id: string }>(
    "SELECT id FROM journal_transactions WHERE tenant_id = $1 AND kind = 'opening' ORDER BY created_at DESC LIMIT 1",
    [original.tenantId],
  );
  const reversing = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Reversing Owner') RETURNING id",
  );
  await expectErrorCode(
    pool.query(
      `INSERT INTO journal_transactions
         (tenant_id, kind, reference, reverses_transaction_id)
       VALUES ($1, 'reversal', 'invalid reversal', $2)`,
      [reversing.rows[0]?.id, journal.rows[0]?.id],
    ),
    '23000',
  );
});

test('rejects a negative cached balance', async () => {
  const { customerId } = await tenantFixture();
  await expectErrorCode(
    pool.query('UPDATE accounts SET balance_minor = -1 WHERE id = $1', [customerId]),
    '23514',
  );
});

test('rejects direct cached balance mutation without postings', async () => {
  const { tenantId, customerId } = await tenantFixture();
  await fundAccount(pool, tenantId, customerId, 'USD', 100n);
  await expectErrorCode(
    pool.query('UPDATE accounts SET balance_minor = balance_minor + 1 WHERE id = $1', [customerId]),
    '23000',
  );
});

test('rejects a posting for an account in another tenant', async () => {
  const first = await tenantFixture();
  const second = await pool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Other Tenant') RETURNING id",
  );
  const accounts = await pool.query<{ id: string }>(
    `INSERT INTO accounts (tenant_id, name, currency)
     VALUES ($1, 'Other A', 'USD'), ($1, 'Other B', 'USD') RETURNING id`,
    [second.rows[0]?.id],
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const journal = await client.query<{ id: string }>(
      "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'opening', 'cross tenant') RETURNING id",
      [first.tenantId],
    );
    await expectErrorCode(
      client.query(
        `INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor)
         VALUES ($1, $2, 'USD', 100), ($1, $3, 'USD', -100)`,
        [journal.rows[0]?.id, accounts.rows[0]?.id, accounts.rows[1]?.id],
      ),
      '23503',
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('rejects a posting whose currency differs from the account', async () => {
  const first = await tenantFixture();
  const second = await pool.query<{ id: string }>(
    "INSERT INTO accounts (tenant_id, name, currency) VALUES ($1, 'Second', 'USD') RETURNING id",
    [first.tenantId],
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const journal = await client.query<{ id: string }>(
      "INSERT INTO journal_transactions (tenant_id, kind, reference) VALUES ($1, 'opening', 'wrong currency') RETURNING id",
      [first.tenantId],
    );
    await expectErrorCode(
      client.query(
        `INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor)
         VALUES ($1, $2, 'MXN', 100), ($1, $3, 'MXN', -100)`,
        [journal.rows[0]?.id, first.customerId, second.rows[0]?.id],
      ),
      '23503',
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('rejects changes to audit history', async () => {
  const { tenantId } = await tenantFixture();
  const event = await pool.query<{ id: string }>(
    `INSERT INTO audit_events
       (tenant_id, actor_id, action, resource_type, request_id, outcome)
     VALUES ($1, 'reviewer', 'reconciliation.checked', 'tenant', 'request-1', 'clean')
     RETURNING id`,
    [tenantId],
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
