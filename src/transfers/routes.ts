import type { FastifyInstance } from 'fastify';
import { requireScope } from '../auth/plugin.ts';
import type { Database } from '../platform/database.ts';
import {
  CreateTransferSchema,
  TransferIdParamsSchema,
  TransferSchema,
  type CreateTransferInput,
  type TransferIdParams,
} from './schemas.ts';
import { TransferService } from './service.ts';

export const registerTransferRoutes = (app: FastifyInstance, database: Database): void => {
  const service = new TransferService(database);

  app.post(
    '/v1/transfers',
    {
      schema: {
        body: CreateTransferSchema,
        response: { 200: TransferSchema, 201: TransferSchema },
      },
    },
    async (request, reply) => {
      requireScope(request, 'transfers:write');
      const result = await service.create(
        request.auth.tenantId,
        request.auth.subject,
        request.id,
        request.body as CreateTransferInput,
        request.headers['idempotency-key'] as string | undefined,
      );
      if (result.replayed) {
        return reply.header('Idempotent-Replayed', 'true').status(200).send(result.transfer);
      }
      return reply.status(201).send(result.transfer);
    },
  );

  app.get(
    '/v1/transfers/:transferId',
    { schema: { params: TransferIdParamsSchema, response: { 200: TransferSchema } } },
    async (request) => {
      requireScope(request, 'transfers:read');
      const { transferId } = request.params as TransferIdParams;
      return service.get(request.auth.tenantId, transferId);
    },
  );
};
