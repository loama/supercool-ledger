import type { QueryResultRow } from 'pg';
import type { Database } from '../platform/database.ts';
import { ServiceError } from '../platform/problem.ts';

export interface AccountRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  name: string;
  currency: 'USD' | 'MXN';
  balance_minor: string;
  status: 'active' | 'closed';
  created_at: Date;
}

export interface AccountEntryRow extends QueryResultRow {
  id: string;
  journal_id: string;
  account_id: string;
  journal_kind: string;
  reference: string;
  amount_minor: string;
  currency: 'USD' | 'MXN';
  created_at: Date;
}

export interface AccountEntryCursor {
  createdAt: string;
  id: string;
}

export class AccountRepository {
  constructor(private readonly database: Database) {}

  async create(tenantId: string, name: string, currency: 'USD' | 'MXN'): Promise<AccountRow> {
    return this.database.transaction(async (client) => {
      const tenant = await client.query<{ status: 'active' | 'suspended' }>(
        'SELECT status FROM tenants WHERE id = $1 FOR SHARE',
        [tenantId],
      );
      if (tenant.rows[0]?.status !== 'active') {
        throw new ServiceError(403, 'tenant_suspended', 'The tenant cannot create accounts.');
      }
      const result = await client.query<AccountRow>(
        `INSERT INTO accounts (tenant_id, name, currency)
         VALUES ($1, $2, $3)
         RETURNING id, tenant_id, name, currency, balance_minor, status, created_at`,
        [tenantId, name, currency],
      );
      const row = result.rows[0];
      if (!row) throw new Error('account_insert_failed');
      return row;
    });
  }

  async find(tenantId: string, accountId: string): Promise<AccountRow | null> {
    const result = await this.database.query<AccountRow>(
      `SELECT id, tenant_id, name, currency, balance_minor, status, created_at
       FROM accounts WHERE tenant_id = $1 AND id = $2`,
      [tenantId, accountId],
    );
    return result.rows[0] ?? null;
  }

  async listEntries(
    tenantId: string,
    accountId: string,
    limit: number,
    cursor: AccountEntryCursor | null,
  ): Promise<AccountEntryRow[]> {
    const result = await this.database.query<AccountEntryRow>(
      `SELECT p.id, p.journal_transaction_id AS journal_id, p.account_id,
              j.kind AS journal_kind, j.reference, p.amount_minor::text,
              p.currency, p.created_at
       FROM postings p
       JOIN journal_transactions j ON j.id = p.journal_transaction_id
       JOIN accounts a ON a.id = p.account_id
       WHERE a.tenant_id = $1 AND j.tenant_id = $1 AND p.account_id = $2
         AND ($3::timestamptz IS NULL OR (p.created_at, p.id) < ($3::timestamptz, $4::uuid))
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $5`,
      [tenantId, accountId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
    );
    return result.rows;
  }
}
