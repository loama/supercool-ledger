export interface AuthContext {
  subject: string;
  tenantId: string;
  scopes: readonly string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}
