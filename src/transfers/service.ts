import type { PoolClient, QueryResultRow } from 'pg';
import { hashRequest } from '../idempotency/hash.ts';
import { validateIdempotencyKey } from '../idempotency/key.ts';
import { formatMinorUnits, parseMoney } from '../money/money.ts';
import type { Currency } from '../money/currencies.ts';
import type { Database } from '../platform/database.ts';
import { ServiceError } from '../platform/problem.ts';
import type { CreateTransferInput } from './schemas.ts';

interface LockedAccount extends QueryResultRow {
  id: string;
  currency: Currency;
  balance_minor: string;
  status: 'active' | 'closed';
  kind: 'customer' | 'system';
}

interface IdempotencyRow extends QueryResultRow {
  request_hash: string;
  state: 'processing' | 'completed';
  response_body: TransferView | null;
}

interface TransferRow extends QueryResultRow {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  currency: Currency;
  amount_minor: string;
  status: 'completed';
  created_at: Date;
}

export interface TransferView {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  currency: Currency;
  status: 'completed';
  createdAt: string;
}

export interface TransferResult {
  replayed: boolean;
  transfer: TransferView;
}

export interface TransferObserver {
  idempotency(decision: 'claimed' | 'replayed' | 'conflict' | 'in_progress'): void;
  transfer(outcome: 'completed' | 'replayed' | 'rejected' | 'failed'): void;
}

const silentObserver: TransferObserver = {
  idempotency: () => undefined,
  transfer: () => undefined,
};

const view = (row: TransferRow): TransferView => ({
  id: row.id,
  sourceAccountId: row.source_account_id,
  destinationAccountId: row.destination_account_id,
  amount: formatMinorUnits(BigInt(row.amount_minor), row.currency),
  currency: row.currency,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

const claim = async (
  client: PoolClient,
  tenantId: string,
  key: string,
  requestHash: string,
  observer: TransferObserver,
): Promise<TransferView | null> => {
  const inserted = await client.query(
    `INSERT INTO idempotency_records (tenant_id, scope, key, request_hash, state)
     VALUES ($1, 'transfers:create', $2, $3, 'processing')
     ON CONFLICT DO NOTHING RETURNING key`,
    [tenantId, key, requestHash],
  );
  if (inserted.rowCount) {
    observer.idempotency('claimed');
    return null;
  }

  const existing = await client.query<IdempotencyRow>(
    `SELECT request_hash, state, response_body
     FROM idempotency_records
     WHERE tenant_id = $1 AND scope = 'transfers:create' AND key = $2
     FOR UPDATE`,
    [tenantId, key],
  );
  const row = existing.rows[0];
  if (!row) throw new Error('idempotency_read_failed');
  if (row.request_hash !== requestHash) {
    observer.idempotency('conflict');
    throw new ServiceError(
      409,
      'idempotency_conflict',
      'The key was already used for another request.',
    );
  }
  if (row.state !== 'completed' || !row.response_body) {
    observer.idempotency('in_progress');
    throw new ServiceError(
      409,
      'idempotency_in_progress',
      'The original request is still processing.',
    );
  }
  observer.idempotency('replayed');
  return row.response_body;
};

export class TransferService {
  constructor(
    private readonly database: Database,
    private readonly observer: TransferObserver = silentObserver,
  ) {}

  async create(
    tenantId: string,
    actorId: string,
    requestId: string,
    input: CreateTransferInput,
    rawKey: string | undefined,
  ): Promise<TransferResult> {
    const key = validateIdempotencyKey(rawKey);
    let money: ReturnType<typeof parseMoney>;
    try {
      money = parseMoney(input);
    } catch {
      throw new ServiceError(422, 'invalid_amount', 'The transfer amount is invalid.');
    }
    if (input.sourceAccountId === input.destinationAccountId) {
      throw new ServiceError(422, 'same_account', 'Source and destination accounts must differ.');
    }
    const requestHash = hashRequest(input);

    try {
      const result = await this.database.transaction(async (client) => {
        const replay = await claim(client, tenantId, key, requestHash, this.observer);
        if (replay) return { replayed: true, transfer: replay };

        const tenant = await client.query<{ status: 'active' | 'suspended' }>(
          'SELECT status FROM tenants WHERE id = $1 FOR SHARE',
          [tenantId],
        );
        if (tenant.rows[0]?.status !== 'active') {
          throw new ServiceError(403, 'tenant_suspended', 'The tenant cannot move funds.');
        }

        const locked = await client.query<LockedAccount>(
          `SELECT id, currency, balance_minor, status, kind
         FROM accounts
         WHERE tenant_id = $1 AND id = ANY($2::uuid[])
         ORDER BY id FOR UPDATE`,
          [tenantId, [input.sourceAccountId, input.destinationAccountId]],
        );
        if (locked.rows.length !== 2) {
          throw new ServiceError(404, 'account_not_found', 'Account not found');
        }
        const source = locked.rows.find((account) => account.id === input.sourceAccountId);
        const destination = locked.rows.find(
          (account) => account.id === input.destinationAccountId,
        );
        if (!source || !destination) throw new Error('locked_account_mapping_failed');
        if (source.status !== 'active' || destination.status !== 'active') {
          throw new ServiceError(422, 'account_inactive', 'Both accounts must be active.');
        }
        if (source.kind !== 'customer' || destination.kind !== 'customer') {
          throw new ServiceError(
            422,
            'system_account_restricted',
            'Customer transfers cannot use system accounts.',
          );
        }
        if (source.currency !== money.currency || destination.currency !== money.currency) {
          throw new ServiceError(
            422,
            'currency_mismatch',
            'Account and transfer currencies must match.',
          );
        }
        if (BigInt(source.balance_minor) < money.amountMinor) {
          throw new ServiceError(
            422,
            'insufficient_funds',
            'The source account has insufficient funds.',
          );
        }

        const journal = await client.query<{ id: string }>(
          `INSERT INTO journal_transactions (tenant_id, kind, reference)
         VALUES ($1, 'transfer', $2) RETURNING id`,
          [tenantId, requestId],
        );
        const journalRow = journal.rows[0];
        if (!journalRow) throw new Error('journal_insert_failed');

        const transfer = await client.query<TransferRow>(
          `INSERT INTO transfers
           (tenant_id, source_account_id, destination_account_id, currency, amount_minor, journal_transaction_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, source_account_id, destination_account_id, currency, amount_minor, status, created_at`,
          [
            tenantId,
            source.id,
            destination.id,
            money.currency,
            money.amountMinor.toString(),
            journalRow.id,
          ],
        );
        const transferRow = transfer.rows[0];
        if (!transferRow) throw new Error('transfer_insert_failed');

        await client.query(
          `INSERT INTO postings (journal_transaction_id, account_id, currency, amount_minor)
         VALUES ($1, $2, $4, $5), ($1, $3, $4, $6)`,
          [
            journalRow.id,
            source.id,
            destination.id,
            money.currency,
            (-money.amountMinor).toString(),
            money.amountMinor.toString(),
          ],
        );
        await client.query(
          `UPDATE accounts
         SET balance_minor = CASE
           WHEN id = $1 THEN balance_minor - $3::bigint
           WHEN id = $2 THEN balance_minor + $3::bigint
         END, updated_at = now()
         WHERE id = ANY($4::uuid[])`,
          [source.id, destination.id, money.amountMinor.toString(), [source.id, destination.id]],
        );

        const response = view(transferRow);
        await client.query(
          `INSERT INTO audit_events
           (tenant_id, actor_id, action, resource_type, resource_id, request_id, outcome)
         VALUES ($1, $2, 'transfer.created', 'transfer', $3, $4, 'completed')`,
          [tenantId, actorId, response.id, requestId],
        );
        await client.query(
          `UPDATE idempotency_records
         SET state = 'completed', response_status = 201, response_body = $4::jsonb,
             resource_id = $3, completed_at = now()
         WHERE tenant_id = $1 AND scope = 'transfers:create' AND key = $2`,
          [tenantId, key, response.id, JSON.stringify(response)],
        );
        return { replayed: false, transfer: response };
      });
      this.observer.transfer(result.replayed ? 'replayed' : 'completed');
      return result;
    } catch (error) {
      this.observer.transfer(error instanceof ServiceError ? 'rejected' : 'failed');
      throw error;
    }
  }

  async get(tenantId: string, transferId: string): Promise<TransferView> {
    const result = await this.database.query<TransferRow>(
      `SELECT id, source_account_id, destination_account_id, currency, amount_minor, status, created_at
       FROM transfers WHERE tenant_id = $1 AND id = $2`,
      [tenantId, transferId],
    );
    const row = result.rows[0];
    if (!row) throw new ServiceError(404, 'transfer_not_found', 'Transfer not found');
    return view(row);
  }
}
