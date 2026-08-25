import Fastify, { type FastifyInstance } from 'fastify';
import { registerProblemHandler } from './platform/problem.ts';

export interface DatabaseHealth {
  ping(): Promise<void>;
}

export interface AppOptions {
  database: DatabaseHealth | null;
}

export const buildApp = async (options: AppOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
  });

  registerProblemHandler(app);

  app.get('/health/live', () => ({ status: 'alive' }));
  app.get('/health/ready', async (_request, reply) => {
    if (!options.database) {
      return reply.status(503).send({ status: 'not_ready' });
    }
    await options.database.ping();
    return { status: 'ready' };
  });

  await app.ready();
  return app;
};
