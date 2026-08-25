import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { requireScope } from '../auth/plugin.ts';
import type { Database } from '../platform/database.ts';
import { AuthenticationProblemSchema, AuthorizationProblemSchema } from '../platform/problem.ts';
import { withSpan } from '../observability/tracing.ts';
import { reconcile } from './service.ts';

const ReconciliationSchema = Type.Object(
  {
    checkedAccounts: Type.Integer({ minimum: 0 }),
    discrepancies: Type.Array(
      Type.Object({
        accountId: Type.String({ format: 'uuid' }),
        cachedMinor: Type.String(),
        ledgerMinor: Type.String(),
      }),
    ),
  },
  { examples: [{ checkedAccounts: 3, discrepancies: [] }] },
);

export const registerReconciliationRoutes = (app: FastifyInstance, database: Database): void => {
  app.get(
    '/v1/operations/reconciliation',
    {
      schema: {
        operationId: 'runReconciliation',
        tags: ['Operations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: ReconciliationSchema,
          401: AuthenticationProblemSchema,
          403: AuthorizationProblemSchema,
        },
      },
    },
    async (request) => {
      requireScope(request, 'operations:read');
      const result = await withSpan(
        'ledger.reconciliation.run',
        { 'financial.operation': 'reconciliation' },
        () => reconcile(database, request.auth.tenantId),
        request.serviceContext,
      );
      const outcome = result.discrepancies.length === 0 ? 'clean' : 'discrepancy';
      await database.query(
        `INSERT INTO audit_events
           (tenant_id, actor_id, action, resource_type, request_id, outcome, metadata)
         VALUES ($1, $2, 'reconciliation.checked', 'tenant', $3, $4, $5::jsonb)`,
        [
          request.auth.tenantId,
          request.auth.subject,
          request.id,
          outcome,
          JSON.stringify({ discrepancy_count: result.discrepancies.length }),
        ],
      );
      app.serviceMetrics.reconciliation.inc({
        outcome,
      });
      return result;
    },
  );
};
