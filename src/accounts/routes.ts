import type { FastifyInstance } from 'fastify';
import { requireScope } from '../auth/plugin.ts';
import type { Database } from '../platform/database.ts';
import { AccountRepository } from './repository.ts';
import { AccountIdParamsSchema, AccountSchema, CreateAccountSchema } from './schemas.ts';
import type { AccountIdParams, CreateAccountInput } from './schemas.ts';
import { AccountService } from './service.ts';

export const registerAccountRoutes = (app: FastifyInstance, database: Database): void => {
  const service = new AccountService(new AccountRepository(database));

  app.post(
    '/v1/accounts',
    { schema: { body: CreateAccountSchema, response: { 201: AccountSchema } } },
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
    { schema: { params: AccountIdParamsSchema, response: { 200: AccountSchema } } },
    async (request) => {
      requireScope(request, 'accounts:read');
      const { accountId } = request.params as AccountIdParams;
      return service.get(request.auth.tenantId, accountId);
    },
  );
};
