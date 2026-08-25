import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { requireScope } from '../auth/plugin.ts';
import type { Database } from '../platform/database.ts';
import { withSpan } from '../observability/tracing.ts';
import { reconcile } from './service.ts';

const ReconciliationSchema = Type.Object({
  checkedAccounts: Type.Integer({ minimum: 0 }),
  discrepancies: Type.Array(
    Type.Object({
      accountId: Type.String({ format: 'uuid' }),
      cachedMinor: Type.String(),
      ledgerMinor: Type.String(),
    }),
  ),
});

export const registerReconciliationRoutes = (app: FastifyInstance, database: Database): void => {
  app.get(
    '/v1/operations/reconciliation',
    {
      schema: {
        operationId: 'runReconciliation',
        tags: ['Operations'],
        security: [{ bearerAuth: [] }],
        response: { 200: ReconciliationSchema },
      },
    },
    async (request) => {
      requireScope(request, 'operations:read');
      const result = await withSpan(
        'ledger.reconciliation.run',
        { 'financial.operation': 'reconciliation' },
        () => reconcile(database, request.auth.tenantId),
      );
      app.serviceMetrics.reconciliation.inc({
        outcome: result.discrepancies.length === 0 ? 'clean' : 'discrepancy',
      });
      return result;
    },
  );
};
