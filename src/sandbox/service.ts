import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { signDevelopmentToken } from '../auth/token.ts';
import { seedDemoTenant } from '../ledger/seed.ts';
import { formatMinorUnits } from '../money/money.ts';
import type { Database } from '../platform/database.ts';
import { ServiceError } from '../platform/problem.ts';

const sessionDurationMilliseconds = 15 * 60 * 1_000;
const sandboxScopes = ['accounts:read', 'transfers:read', 'transfers:write', 'operations:read'];

export interface SandboxAccount {
  id: string;
  name: string;
  currency: 'USD' | 'MXN';
  balance: string;
}

export interface SandboxSession {
  tenantId: string;
  token: string;
  expiresAt: string;
  accounts: SandboxAccount[];
}

export interface SandboxLimits {
  activeLimit: number;
  dailyLimit: number;
}

interface AdmissionCount extends QueryResultRow {
  active_count: string;
  daily_count: string;
}

interface AccountRow extends QueryResultRow {
  id: string;
  name: string;
  currency: 'USD' | 'MXN';
  balance_minor: string;
}

const defaultLimits: SandboxLimits = {
  activeLimit: 40,
  dailyLimit: 200,
};

export class SandboxService {
  private readonly limits: SandboxLimits;

  constructor(
    private readonly database: Database,
    private readonly authSecret: string,
    limits: SandboxLimits = defaultLimits,
  ) {
    if (limits.activeLimit < 1 || limits.dailyLimit < limits.activeLimit) {
      throw new Error('invalid_sandbox_limits');
    }
    this.limits = limits;
  }

  async createSession(): Promise<SandboxSession> {
    return this.database.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('supercool-sandbox-admission'))");
      await client.query('SELECT purge_expired_sandbox_tenants()');
      const admission = await client.query<AdmissionCount>(
        `SELECT
           count(*) FILTER (WHERE expires_at > now())::text AS active_count,
           count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::text AS daily_count
        FROM sandbox_sessions`,
      );
      const counts = admission.rows[0];
      if (
        !counts ||
        Number(counts.active_count) >= this.limits.activeLimit ||
        Number(counts.daily_count) >= this.limits.dailyLimit
      ) {
        throw new ServiceError(
          429,
          'sandbox_capacity_reached',
          'The public sandbox is at capacity. Try again later.',
        );
      }

      const seed = await seedDemoTenant(
        client,
        `Reviewer Sandbox ${randomUUID().slice(0, 8)}`,
        true,
      );
      const expiresAt = new Date(Date.now() + sessionDurationMilliseconds);
      await client.query('SELECT record_sandbox_session($1, $2)', [seed.tenantId, expiresAt]);
      const accountRows = await client.query<AccountRow>(
        `SELECT id, name, currency, balance_minor::text
         FROM accounts
         WHERE tenant_id = $1 AND id = ANY($2::uuid[])
         ORDER BY CASE WHEN id = $3 THEN 0 ELSE 1 END`,
        [seed.tenantId, [seed.sourceAccountId, seed.destinationAccountId], seed.sourceAccountId],
      );
      const token = await signDevelopmentToken(
        {
          subject: 'sandbox-reviewer',
          tenantId: seed.tenantId,
          scopes: sandboxScopes,
        },
        this.authSecret,
      );

      return {
        tenantId: seed.tenantId,
        token,
        expiresAt: expiresAt.toISOString(),
        accounts: accountRows.rows.map((account) => ({
          id: account.id,
          name: account.name,
          currency: account.currency,
          balance: formatMinorUnits(BigInt(account.balance_minor), account.currency),
        })),
      };
    });
  }
}
