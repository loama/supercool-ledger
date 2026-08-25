import swagger from '@fastify/swagger';
import apiReference from '@scalar/fastify-api-reference';
import type { FastifyInstance } from 'fastify';

export const registerOpenApi = async (app: FastifyInstance): Promise<void> => {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'SuperCool Ledger API',
        description: 'Account balances backed by an immutable double entry ledger.',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  await app.register(apiReference, {
    routePrefix: '/docs',
    configuration: {
      theme: 'kepler',
      layout: 'modern',
      defaultOpenAllTags: false,
    },
  });
};
