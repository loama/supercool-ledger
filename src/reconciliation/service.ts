import type { QueryResultRow } from 'pg';
import type { Database } from '../platform/database.ts';

interface ReconciliationRow extends QueryResultRow {
  account_id: string;
  cached_minor: string;
  ledger_minor: string;
}

export interface ReconciliationDiscrepancy {
  accountId: string;
  cachedMinor: string;
  ledgerMinor: string;
}

export interface ReconciliationResult {
  checkedAccounts: number;
  discrepancies: ReconciliationDiscrepancy[];
}

export const reconcile = async (database: Database): Promise<ReconciliationResult> => {
  const result = await database.query<ReconciliationRow>(`
    SELECT
      a.id AS account_id,
      a.balance_minor::text AS cached_minor,
      COALESCE(sum(p.amount_minor), 0)::text AS ledger_minor
    FROM accounts a
    LEFT JOIN postings p ON p.account_id = a.id
    GROUP BY a.id, a.balance_minor
    ORDER BY a.id
  `);
  const discrepancies = result.rows
    .filter((row) => row.cached_minor !== row.ledger_minor)
    .map((row) => ({
      accountId: row.account_id,
      cachedMinor: row.cached_minor,
      ledgerMinor: row.ledger_minor,
    }));
  return { checkedAccounts: result.rows.length, discrepancies };
};
