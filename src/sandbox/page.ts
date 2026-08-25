import type { FastifyInstance, FastifyReply } from 'fastify';

const files = {
  html: Bun.file(new URL('./public/index.html', import.meta.url)).text(),
  styles: Bun.file(new URL('./public/styles.css', import.meta.url)).text(),
  script: Bun.file(new URL('./client/app.ts', import.meta.url))
    .text()
    .then((source) => new Bun.Transpiler({ loader: 'ts' }).transformSync(source)),
};

const contentSecurityPolicy =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

const secureReply = (reply: FastifyReply): FastifyReply =>
  reply
    .header('cache-control', 'no-store')
    .header('content-security-policy', contentSecurityPolicy)
    .header('permissions-policy', 'camera=(), microphone=(), geolocation=()')
    .header('referrer-policy', 'no-referrer')
    .header('x-content-type-options', 'nosniff');

export const registerSandboxPageRoutes = (app: FastifyInstance): void => {
  app.get('/sandbox', async (_request, reply) =>
    secureReply(reply)
      .type('text/html; charset=utf-8')
      .send(await files.html),
  );
  app.get('/sandbox/styles.css', async (_request, reply) =>
    secureReply(reply)
      .type('text/css; charset=utf-8')
      .send(await files.styles),
  );
  app.get('/sandbox/app.js', async (_request, reply) =>
    secureReply(reply)
      .type('text/javascript; charset=utf-8')
      .send(await files.script),
  );
};
