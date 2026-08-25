import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyToken } from './token.ts';

export class AuthenticationError extends Error {
  constructor() {
    super('authentication_required');
  }
}

export class AuthorizationError extends Error {
  constructor() {
    super('insufficient_scope');
  }
}

export const registerAuthentication = (app: FastifyInstance, secret: string): void => {
  app.decorateRequest('auth');
  app.addHook('onRequest', async (request) => {
    if (
      request.url.startsWith('/health/') ||
      request.url === '/docs' ||
      request.url.startsWith('/docs/') ||
      request.url === '/openapi.json' ||
      request.url === '/metrics'
    ) {
      return;
    }
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new AuthenticationError();
    try {
      request.auth = await verifyToken(authorization.slice(7), secret);
    } catch {
      throw new AuthenticationError();
    }
  });
};

export const requireScope = (request: FastifyRequest, scope: string): void => {
  if (!request.auth.scopes.includes(scope)) throw new AuthorizationError();
};
