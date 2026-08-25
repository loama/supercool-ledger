import type { QueryResultRow } from 'pg';
import type { Database } from '../platform/database.ts';

export interface AccountRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  name: string;
  currency: 'USD' | 'MXN';
  balance_minor: string;
  status: 'active' | 'closed';
  created_at: Date;
}

export class AccountRepository {
  constructor(private readonly database: Database) {}

  async create(tenantId: string, name: string, currency: 'USD' | 'MXN'): Promise<AccountRow> {
    const result = await this.database.query<AccountRow>(
      `INSERT INTO accounts (tenant_id, name, currency)
       VALUES ($1, $2, $3)
       RETURNING id, tenant_id, name, currency, balance_minor, status, created_at`,
      [tenantId, name, currency],
    );
    const row = result.rows[0];
    if (!row) throw new Error('account_insert_failed');
    return row;
  }

  async find(tenantId: string, accountId: string): Promise<AccountRow | null> {
    const result = await this.database.query<AccountRow>(
      `SELECT id, tenant_id, name, currency, balance_minor, status, created_at
       FROM accounts WHERE tenant_id = $1 AND id = $2`,
      [tenantId, accountId],
    );
    return result.rows[0] ?? null;
  }
}
