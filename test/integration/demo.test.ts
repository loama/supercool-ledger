import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Pool } from 'pg';
import { runDemo } from '../../src/demo/run.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';

let pool: Pool;
let database: Database;

beforeAll(async () => {
  pool = createTestPool();
  const client = await pool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
  await migrate(pool);
  database = createDatabase(testDatabaseUrl);
});

afterAll(async () => {
  await database.close();
  await pool.end();
});

test('captures success replay rejection and reconciliation from the running service', async () => {
  const result = await runDemo(database, 'a-development-secret-with-more-than-32-characters');
  expect(result.success.status).toBe(201);
  expect(result.replay.status).toBe(200);
  expect(result.replay.sameTransfer).toBe(true);
  expect(result.overspend.status).toBe(422);
  expect(result.overspend.code).toBe('insufficient_funds');
  expect(result.reconciliation.discrepancies).toEqual([]);
  expect(JSON.stringify(result)).not.toContain('Bearer ');
  expect(JSON.stringify(result)).not.toContain('demo-transfer-key');
});
