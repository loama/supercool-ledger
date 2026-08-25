import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../platform/database.ts';
import { TooManyRequestsProblemSchema } from '../platform/problem.ts';
import { SandboxService } from './service.ts';

const SandboxSessionSchema = Type.Object(
  {
    tenantId: Type.String({ format: 'uuid' }),
    token: Type.String({ minLength: 1 }),
    expiresAt: Type.String({ format: 'date-time' }),
    accounts: Type.Array(
      Type.Object({
        id: Type.String({ format: 'uuid' }),
        name: Type.String(),
        currency: Type.Union([Type.Literal('USD'), Type.Literal('MXN')]),
        balance: Type.String({ pattern: '^\\d+\\.\\d{2}$' }),
      }),
      { minItems: 2, maxItems: 2 },
    ),
  },
  {
    description:
      'A short lived reviewer session containing synthetic accounts and a tenant scoped token.',
  },
);

export const registerSandboxRoutes = (
  app: FastifyInstance,
  database: Database,
  authSecret: string,
): void => {
  const service = new SandboxService(database, authSecret);

  app.post(
    '/v1/sandbox/sessions',
    {
      schema: {
        operationId: 'createSandboxSession',
        tags: ['Sandbox'],
        description:
          'Creates an isolated synthetic tenant for reviewing successful and rejected ledger operations.',
        response: {
          201: SandboxSessionSchema,
          429: TooManyRequestsProblemSchema,
        },
      },
    },
    async (_request, reply) => {
      const session = await service.createSession();
      return reply.header('cache-control', 'no-store').status(201).send(session);
    },
  );
};
