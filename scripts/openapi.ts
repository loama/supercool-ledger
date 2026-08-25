import { buildApp } from '../src/app.ts';
import { createDatabase } from '../src/platform/database.ts';
import { format, resolveConfig } from 'prettier';

const database = createDatabase('postgres://unused:unused@127.0.0.1:1/unused');
const app = await buildApp({
  database,
  authSecret: 'openapi-generation-secret-with-32-characters',
  metricsToken: 'openapi-generation-metrics-token',
});
try {
  const prettierConfig = await resolveConfig('openapi.json');
  const document = await format(JSON.stringify(app.swagger()), {
    ...prettierConfig,
    filepath: 'openapi.json',
  });
  await Bun.write('openapi.json', document);
} finally {
  await app.close();
  await database.close();
}
