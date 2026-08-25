import { buildApp } from '../app.ts';
import { signDevelopmentToken } from '../auth/token.ts';
import { seedDemo } from '../ledger/seed.ts';
import type { Database } from '../platform/database.ts';
import { reconcile } from '../reconciliation/service.ts';

interface ResponseCapture {
  status: number;
  body: Record<string, unknown>;
}

export interface DemoRun {
  generatedAt: string;
  accounts: {
    sourceAccountId: string;
    destinationAccountId: string;
    openingBalance: string;
  };
  success: ResponseCapture;
  replay: ResponseCapture & { sameTransfer: boolean };
  overspend: { status: number; code: string };
  reconciliation: Awaited<ReturnType<typeof reconcile>>;
  postings: { accountId: string; amountMinor: string }[];
}

export const runDemo = async (database: Database, authSecret: string): Promise<DemoRun> => {
  const seed = await seedDemo(database);
  const token = await signDevelopmentToken(
    {
      subject: 'demo-reviewer',
      tenantId: seed.tenantId,
      scopes: ['accounts:read', 'transfers:read', 'transfers:write'],
    },
    authSecret,
  );
  const app = await buildApp({ database, authSecret, metricsToken: 'demo-metrics-token' });
  const payload = {
    sourceAccountId: seed.sourceAccountId,
    destinationAccountId: seed.destinationAccountId,
    amount: '250.00',
    currency: 'USD',
  };
  const send = (key: string, body: typeof payload) =>
    app.inject({
      method: 'POST',
      url: '/v1/transfers',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
      payload: body,
    });
  try {
    const successResponse = await send('demo-transfer-key', payload);
    const replayResponse = await send('demo-transfer-key', payload);
    const overspendResponse = await send('demo-overspend-key', { ...payload, amount: '999999.00' });
    const successBody = JSON.parse(successResponse.body) as Record<string, unknown>;
    const replayBody = JSON.parse(replayResponse.body) as Record<string, unknown>;
    const overspendBody = JSON.parse(overspendResponse.body) as { code?: string };
    const transferId = successBody.id;
    if (typeof transferId !== 'string') throw new Error('demo_transfer_failed');
    const postingRows = await database.query<{ account_id: string; amount_minor: string }>(
      `SELECT p.account_id, p.amount_minor::text
       FROM postings p
       JOIN transfers t ON t.journal_transaction_id = p.journal_transaction_id
       WHERE t.id = $1 ORDER BY p.amount_minor`,
      [transferId],
    );
    return {
      generatedAt: new Date().toISOString(),
      accounts: {
        sourceAccountId: seed.sourceAccountId,
        destinationAccountId: seed.destinationAccountId,
        openingBalance: '1000.00',
      },
      success: { status: successResponse.statusCode, body: successBody },
      replay: {
        status: replayResponse.statusCode,
        body: replayBody,
        sameTransfer: replayBody.id === successBody.id,
      },
      overspend: {
        status: overspendResponse.statusCode,
        code: overspendBody.code ?? 'unknown_error',
      },
      reconciliation: await reconcile(database, seed.tenantId),
      postings: postingRows.rows.map((row) => ({
        accountId: row.account_id,
        amountMinor: row.amount_minor,
      })),
    };
  } finally {
    await app.close();
  }
};
