import type { FastifyInstance } from 'fastify';
import * as Sentry from '@sentry/node';
import { Type } from '@sinclair/typebox';
import { AuthenticationError, AuthorizationError } from '../auth/plugin.ts';

const problemFields = {
  type: Type.String(),
  title: Type.String(),
  status: Type.Integer(),
  detail: Type.String(),
  instance: Type.String(),
  code: Type.String(),
};

const documentedProblem = (
  status: number,
  title: string,
  detail: string,
  instance: string,
  code: string,
) =>
  Type.Object(problemFields, {
    examples: [{ type: 'about:blank', title, status, detail, instance, code }],
  });

export const ValidationProblemSchema = documentedProblem(
  400,
  'Bad Request',
  'The request did not match the API contract.',
  '/v1/transfers',
  'validation_error',
);
export const AuthenticationProblemSchema = documentedProblem(
  401,
  'Unauthorized',
  'Authentication is required.',
  '/v1/transfers',
  'authentication_required',
);
export const AuthorizationProblemSchema = documentedProblem(
  403,
  'Forbidden',
  'The token does not grant this operation.',
  '/v1/transfers',
  'insufficient_scope',
);
export const NotFoundProblemSchema = documentedProblem(
  404,
  'Not Found',
  'Account not found',
  '/v1/accounts/3179592d-b63f-40c0-9c7f-1cfeb468379f',
  'account_not_found',
);
export const ConflictProblemSchema = documentedProblem(
  409,
  'Request Rejected',
  'The key was already used for another request.',
  '/v1/transfers',
  'idempotency_conflict',
);
export const UnprocessableProblemSchema = documentedProblem(
  422,
  'Request Rejected',
  'The source account has insufficient funds.',
  '/v1/transfers',
  'insufficient_funds',
);

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
    request.log.error(
      {
        err: error,
        code: 'internal_error',
        request_id: request.id,
        ...(request.traceId ? { trace_id: request.traceId } : {}),
      },
      'request failed',
    );
    Sentry.captureException(error, {
      tags: { request_id: request.id, route: request.routeOptions.url ?? 'unmatched' },
    });
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
