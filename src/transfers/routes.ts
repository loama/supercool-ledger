import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { requireScope } from '../auth/plugin.ts';
import type { Database } from '../platform/database.ts';
import {
  AuthenticationProblemSchema,
  AuthorizationProblemSchema,
  ConflictProblemSchema,
  NotFoundProblemSchema,
  UnprocessableProblemSchema,
  ValidationProblemSchema,
} from '../platform/problem.ts';
import { withSpan } from '../observability/tracing.ts';
import {
  CreateTransferSchema,
  TransferIdParamsSchema,
  TransferSchema,
  type CreateTransferInput,
  type TransferIdParams,
} from './schemas.ts';
import { TransferService } from './service.ts';

export const registerTransferRoutes = (app: FastifyInstance, database: Database): void => {
  const service = new TransferService(database, {
    idempotency: (decision) => {
      app.serviceMetrics.idempotency.inc({ decision });
    },
    transfer: (outcome) => {
      app.serviceMetrics.transfers.inc({ outcome });
    },
  });

  app.post(
    '/v1/transfers',
    {
      schema: {
        operationId: 'createTransfer',
        tags: ['Transfers'],
        security: [{ bearerAuth: [] }],
        headers: Type.Object({
          'idempotency-key': Type.String({ minLength: 8, maxLength: 128 }),
        }),
        body: CreateTransferSchema,
        response: {
          200: TransferSchema,
          201: TransferSchema,
          400: ValidationProblemSchema,
          401: AuthenticationProblemSchema,
          403: AuthorizationProblemSchema,
          404: NotFoundProblemSchema,
          409: ConflictProblemSchema,
          422: UnprocessableProblemSchema,
        },
      },
    },
    async (request, reply) => {
      requireScope(request, 'transfers:write');
      const result = await withSpan(
        'ledger.transfer.create',
        { 'financial.operation': 'transfer' },
        () =>
          service.create(
            request.auth.tenantId,
            request.auth.subject,
            request.id,
            request.body as CreateTransferInput,
            request.headers['idempotency-key'] as string | undefined,
          ),
        request.serviceContext,
      );
      if (result.replayed) {
        return reply.header('Idempotent-Replayed', 'true').status(200).send(result.transfer);
      }
      return reply.status(201).send(result.transfer);
    },
  );

  app.get(
    '/v1/transfers/:transferId',
    {
      schema: {
        operationId: 'getTransfer',
        tags: ['Transfers'],
        security: [{ bearerAuth: [] }],
        params: TransferIdParamsSchema,
        response: {
          200: TransferSchema,
          400: ValidationProblemSchema,
          401: AuthenticationProblemSchema,
          403: AuthorizationProblemSchema,
          404: NotFoundProblemSchema,
        },
      },
    },
    async (request) => {
      requireScope(request, 'transfers:read');
      const { transferId } = request.params as TransferIdParams;
      return service.get(request.auth.tenantId, transferId);
    },
  );
};
