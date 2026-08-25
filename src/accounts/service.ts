import { formatMinorUnits } from '../money/money.ts';
import { ServiceError } from '../platform/problem.ts';
import type { AccountRepository, AccountRow } from './repository.ts';
import type { CreateAccountInput } from './schemas.ts';

export interface AccountView {
  id: string;
  name: string;
  currency: 'USD' | 'MXN';
  balance: string;
  status: string;
  createdAt: string;
}

const toView = (row: AccountRow): AccountView => ({
  id: row.id,
  name: row.name,
  currency: row.currency,
  balance: formatMinorUnits(BigInt(row.balance_minor), row.currency),
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

export class AccountService {
  constructor(private readonly repository: AccountRepository) {}

  async create(tenantId: string, input: CreateAccountInput): Promise<AccountView> {
    return toView(await this.repository.create(tenantId, input.name, input.currency));
  }

  async get(tenantId: string, accountId: string): Promise<AccountView> {
    const row = await this.repository.find(tenantId, accountId);
    if (!row) throw new ServiceError(404, 'account_not_found', 'Account not found');
    return toView(row);
  }
}
