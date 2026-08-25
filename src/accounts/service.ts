import { formatMinorUnits } from '../money/money.ts';
import { ServiceError } from '../platform/problem.ts';
import type {
  AccountEntryCursor,
  AccountEntryRow,
  AccountRepository,
  AccountRow,
} from './repository.ts';
import type { CreateAccountInput } from './schemas.ts';

export interface AccountView {
  id: string;
  name: string;
  currency: 'USD' | 'MXN';
  balance: string;
  status: string;
  createdAt: string;
}

export interface AccountEntryView {
  id: string;
  journalId: string;
  accountId: string;
  journalKind: string;
  reference: string;
  amount: string;
  currency: 'USD' | 'MXN';
  postedAt: string;
}

export interface AccountEntriesView {
  entries: AccountEntryView[];
  nextCursor: string | null;
}

const toView = (row: AccountRow): AccountView => ({
  id: row.id,
  name: row.name,
  currency: row.currency,
  balance: formatMinorUnits(BigInt(row.balance_minor), row.currency),
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

const toEntryView = (row: AccountEntryRow): AccountEntryView => ({
  id: row.id,
  journalId: row.journal_id,
  accountId: row.account_id,
  journalKind: row.journal_kind,
  reference: row.reference,
  amount: formatMinorUnits(BigInt(row.amount_minor), row.currency),
  currency: row.currency,
  postedAt: row.created_at.toISOString(),
});

const encodeCursor = (row: AccountEntryRow): string =>
  Buffer.from(JSON.stringify({ createdAt: row.created_at.toISOString(), id: row.id })).toString(
    'base64url',
  );

const decodeCursor = (value: string | undefined): AccountEntryCursor | null => {
  if (!value) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<AccountEntryCursor>;
    if (
      typeof decoded.createdAt !== 'string' ||
      Number.isNaN(Date.parse(decoded.createdAt)) ||
      typeof decoded.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.id)
    ) {
      throw new Error('invalid_cursor');
    }
    return { createdAt: decoded.createdAt, id: decoded.id };
  } catch {
    throw new ServiceError(400, 'invalid_cursor', 'The account entry cursor is invalid.');
  }
};

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

  async listEntries(
    tenantId: string,
    accountId: string,
    limit: number,
    cursorValue: string | undefined,
  ): Promise<AccountEntriesView> {
    await this.get(tenantId, accountId);
    const rows = await this.repository.listEntries(
      tenantId,
      accountId,
      limit,
      decodeCursor(cursorValue),
    );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const finalEntry = page.at(-1);
    return {
      entries: page.map(toEntryView),
      nextCursor: hasMore && finalEntry ? encodeCursor(finalEntry) : null,
    };
  }
}
