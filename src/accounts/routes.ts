import type { FastifyInstance } from 'fastify';
import { requireScope } from '../auth/plugin.ts';
import type { Database } from '../platform/database.ts';
import { AccountRepository } from './repository.ts';
import {
  AccountEntriesQuerySchema,
  AccountEntriesSchema,
  AccountIdParamsSchema,
  AccountSchema,
  CreateAccountSchema,
} from './schemas.ts';
import type { AccountEntriesQuery, AccountIdParams, CreateAccountInput } from './schemas.ts';
import { AccountService } from './service.ts';

export const registerAccountRoutes = (app: FastifyInstance, database: Database): void => {
  const service = new AccountService(new AccountRepository(database));

  app.post(
    '/v1/accounts',
    {
      schema: {
        operationId: 'createAccount',
        tags: ['Accounts'],
        security: [{ bearerAuth: [] }],
        body: CreateAccountSchema,
        response: { 201: AccountSchema },
      },
    },
    async (request, reply) => {
      requireScope(request, 'accounts:write');
      const account = await service.create(
        request.auth.tenantId,
        request.body as CreateAccountInput,
      );
      return reply.status(201).send(account);
    },
  );

  app.get(
    '/v1/accounts/:accountId',
    {
      schema: {
        operationId: 'getAccount',
        tags: ['Accounts'],
        security: [{ bearerAuth: [] }],
        params: AccountIdParamsSchema,
        response: { 200: AccountSchema },
      },
    },
    async (request) => {
      requireScope(request, 'accounts:read');
      const { accountId } = request.params as AccountIdParams;
      return service.get(request.auth.tenantId, accountId);
    },
  );

  app.get(
    '/v1/accounts/:accountId/entries',
    {
      schema: {
        operationId: 'listAccountEntries',
        tags: ['Accounts'],
        security: [{ bearerAuth: [] }],
        params: AccountIdParamsSchema,
        querystring: AccountEntriesQuerySchema,
        response: { 200: AccountEntriesSchema },
      },
    },
    async (request) => {
      requireScope(request, 'accounts:read');
      const { accountId } = request.params as AccountIdParams;
      const { limit = 50, cursor } = request.query as AccountEntriesQuery;
      return service.listEntries(request.auth.tenantId, accountId, limit, cursor);
    },
  );
};
