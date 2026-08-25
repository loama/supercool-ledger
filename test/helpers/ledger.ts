import type { Pool } from 'pg';

export const fundAccount = async (
  pool: Pool,
  tenantId: string,
  accountId: string,
  currency: 'USD' | 'MXN',
  amountMinor: bigint,
): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const treasury = await client.query<{ id: string }>(
      `INSERT INTO accounts (tenant_id, name, currency, kind, balance_minor)
       VALUES ($1, 'System Treasury', $2, 'system', 0) RETURNING id`,
      [tenantId, currency],
    );
    const treasuryRow = treasury.rows[0];
    if (!treasuryRow) throw new Error('treasury_fixture_failed');
    const journal = await client.query<{ id: string }>(
      `INSERT INTO journal_transactions (tenant_id, kind, reference)
       VALUES ($1, 'opening', 'test funding') RETURNING id`,
      [tenantId],
    );
    const journalRow = journal.rows[0];
    if (!journalRow) throw new Error('journal_fixture_failed');
    await client.query(
      `INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor)
       VALUES ($1, $2, $3, $4), ($1, $5, $3, $6)`,
      [
        journalRow.id,
        accountId,
        currency,
        amountMinor.toString(),
        treasuryRow.id,
        (-amountMinor).toString(),
      ],
    );
    await client.query('UPDATE accounts SET balance_minor = $1 WHERE id = $2', [
      amountMinor.toString(),
      accountId,
    ]);
    await client.query('UPDATE accounts SET balance_minor = $1 WHERE id = $2', [
      (-amountMinor).toString(),
      treasuryRow.id,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
