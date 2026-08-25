import type { FastifyInstance } from 'fastify';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
}

export const registerProblemHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((error, request, reply) => {
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
