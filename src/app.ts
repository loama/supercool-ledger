import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { registerAccountRoutes } from './accounts/routes.ts';
import { registerAuthentication } from './auth/plugin.ts';
import type { Database } from './platform/database.ts';
import { createLoggerOptions } from './observability/logger.ts';
import { registerMetrics } from './observability/metrics.ts';
import { registerTracing } from './observability/tracing.ts';
import { registerOpenApi } from './platform/openapi.ts';
import { registerProblemHandler } from './platform/problem.ts';
import { registerTransferRoutes } from './transfers/routes.ts';
import { registerReconciliationRoutes } from './reconciliation/routes.ts';

export interface DatabaseHealth {
  ping(): Promise<void>;
}

export interface AppOptions {
  database: (Database & DatabaseHealth) | null;
  authSecret?: string;
  metricsToken?: string;
  logLevel?: string;
}

export const buildApp = async (options: AppOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: createLoggerOptions(options.logLevel ?? 'silent'),
    requestIdHeader: 'x-request-id',
    logController: new LogController({ disableRequestLogging: true }),
  });

  registerTracing(app);
  registerProblemHandler(app);
  await registerOpenApi(app);
  registerMetrics(app, options.metricsToken);

  if (options.database) {
    if (!options.authSecret) throw new Error('missing_app_option:authSecret');
    registerAuthentication(app, options.authSecret);
    registerAccountRoutes(app, options.database);
    registerTransferRoutes(app, options.database);
    registerReconciliationRoutes(app, options.database);
  }

  app.get('/health/live', () => ({ status: 'alive' }));
  app.get('/health/ready', async (request, reply) => {
    if (!options.database) {
      return reply.status(503).send({ status: 'not_ready' });
    }
    try {
      await options.database.ping();
      return { status: 'ready' };
    } catch {
      request.log.warn({ code: 'readiness_failed', request_id: request.id }, 'readiness failed');
      return reply.status(503).send({ status: 'not_ready' });
    }
  });
  app.get('/openapi.json', () => app.swagger());

  await app.ready();
  return app;
};
