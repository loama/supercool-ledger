import type { FastifyInstance } from 'fastify';
import { AuthenticationError, AuthorizationError } from '../auth/plugin.ts';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
}

export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly publicDetail: string,
  ) {
    super(code);
  }
}

export const registerProblemHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((error, request, reply) => {
    const possibleValidationError = error as { validation?: unknown };
    if (possibleValidationError.validation) {
      return reply
        .type('application/problem+json')
        .status(400)
        .send({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'The request did not match the API contract.',
          instance: request.url,
          code: 'validation_error',
        } satisfies ProblemDetails);
    }
    if (error instanceof AuthenticationError) {
      return reply
        .type('application/problem+json')
        .status(401)
        .send({
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication is required.',
          instance: request.url,
          code: error.message,
        } satisfies ProblemDetails);
    }
    if (error instanceof AuthorizationError) {
      return reply
        .type('application/problem+json')
        .status(403)
        .send({
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'The token does not grant this operation.',
          instance: request.url,
          code: error.message,
        } satisfies ProblemDetails);
    }
    if (error instanceof ServiceError) {
      return reply
        .type('application/problem+json')
        .status(error.status)
        .send({
          type: 'about:blank',
          title: error.status === 404 ? 'Not Found' : 'Request Rejected',
          status: error.status,
          detail: error.publicDetail,
          instance: request.url,
          code: error.code,
        } satisfies ProblemDetails);
    }
    request.log.error({ err: error, code: 'internal_error' }, 'request failed');
    const body: ProblemDetails = {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'The service could not complete the request.',
      instance: request.url,
      code: 'internal_error',
    };
    return reply.type('application/problem+json').status(500).send(body);
  });
};
