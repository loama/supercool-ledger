import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { buildApp } from '../../src/app.ts';
import { signDevelopmentToken } from '../../src/auth/token.ts';
import { createDatabase, type Database } from '../../src/platform/database.ts';
import { migrate } from '../../src/platform/migrate.ts';
import { provisionRuntimeRole } from '../../src/platform/runtime-role.ts';
import { createTestPool, resetDatabase, testDatabaseUrl } from '../helpers/database.ts';
import { fundAccount } from '../helpers/ledger.ts';

const username = `runtime_${randomUUID().replaceAll('-', '')}`;
const password = 'runtime-role-password-with-more-than-20-characters';
const authSecret = 'runtime-role-auth-secret-with-more-than-32-characters';
let adminPool: Pool;
let runtimePool: Pool;
let runtimeDatabase: Database;
let app: FastifyInstance;
let token: string;
let sourceAccountId: string;
let destinationAccountId: string;

beforeAll(async () => {
  adminPool = createTestPool();
  const client = await adminPool.connect();
  try {
    await resetDatabase(client);
  } finally {
    client.release();
  }
  await migrate(adminPool);
  await provisionRuntimeRole(adminPool, { username, password });
  const url = new URL(testDatabaseUrl);
  url.username = username;
  url.password = password;
  runtimePool = new Pool({ connectionString: url.toString() });
  runtimeDatabase = createDatabase(url.toString());

  const tenant = await adminPool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Runtime Application Test') RETURNING id",
  );
  const tenantId = tenant.rows[0]?.id;
  if (!tenantId) throw new Error('runtime_tenant_fixture_failed');
  const accounts = await adminPool.query<{ id: string }>(
    `INSERT INTO accounts (tenant_id, name, currency)
     VALUES ($1, 'Runtime Source', 'USD'), ($1, 'Runtime Destination', 'USD') RETURNING id`,
    [tenantId],
  );
  sourceAccountId = accounts.rows[0]?.id ?? '';
  destinationAccountId = accounts.rows[1]?.id ?? '';
  if (!sourceAccountId || !destinationAccountId) throw new Error('runtime_account_fixture_failed');
  await fundAccount(adminPool, tenantId, sourceAccountId, 'USD', 50_000n);
  token = await signDevelopmentToken(
    {
      subject: 'runtime-reviewer',
      tenantId,
      scopes: ['transfers:write'],
    },
    authSecret,
  );
  app = await buildApp({
    database: runtimeDatabase,
    authSecret,
    metricsToken: 'runtime-metrics-token',
  });
});

afterAll(async () => {
  await app.close();
  await runtimeDatabase.close();
  await runtimePool.end();
  await adminPool.query(`DROP OWNED BY "${username}"`);
  await adminPool.query(`DROP ROLE "${username}"`);
  await adminPool.end();
});

test('runtime role can use application tables and read migration readiness', async () => {
  const tenant = await runtimePool.query<{ id: string }>(
    "INSERT INTO tenants (name) VALUES ('Runtime Role Test') RETURNING id",
  );
  expect(tenant.rows[0]?.id).toBeDefined();

  const privileges = await runtimePool.query<{
    can_create_schema_object: boolean;
    can_delete_postings: boolean;
    can_execute_sandbox_purge: boolean;
    can_lock_tenant_status: boolean;
    can_read_migrations: boolean;
    can_update_accounts: boolean;
  }>(`
    SELECT
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema_object,
      has_table_privilege(current_user, 'postings', 'DELETE') AS can_delete_postings,
      has_function_privilege(current_user, 'purge_expired_sandbox_tenants()', 'EXECUTE') AS can_execute_sandbox_purge,
      has_function_privilege(current_user, 'lock_runtime_tenant_status(uuid)', 'EXECUTE') AS can_lock_tenant_status,
      has_table_privilege(current_user, 'schema_migrations', 'SELECT') AS can_read_migrations,
      has_table_privilege(current_user, 'accounts', 'UPDATE') AS can_update_accounts
  `);
  expect(privileges.rows[0]).toEqual({
    can_create_schema_object: false,
    can_delete_postings: false,
    can_execute_sandbox_purge: true,
    can_lock_tenant_status: true,
    can_read_migrations: true,
    can_update_accounts: true,
  });
});

test('runtime role serves readiness and completes a transfer', async () => {
  const readiness = await app.inject({ method: 'GET', url: '/health/ready' });
  expect(readiness.statusCode).toBe(200);
  expect(JSON.parse(readiness.body)).toEqual({ status: 'ready' });

  const transfer = await app.inject({
    method: 'POST',
    url: '/v1/transfers',
    headers: {
      authorization: `Bearer ${token}`,
      'idempotency-key': 'runtime-role-transfer-001',
    },
    payload: {
      sourceAccountId,
      destinationAccountId,
      amount: '125.00',
      currency: 'USD',
    },
  });
  expect(transfer.statusCode).toBe(201);
  expect(JSON.parse(transfer.body)).toMatchObject({ amount: '125.00', status: 'completed' });

  const balances = await adminPool.query<{ id: string; balance_minor: string }>(
    'SELECT id, balance_minor FROM accounts WHERE id = ANY($1::uuid[])',
    [[sourceAccountId, destinationAccountId]],
  );
  expect(new Map(balances.rows.map((row) => [row.id, row.balance_minor]))).toEqual(
    new Map([
      [sourceAccountId, '37500'],
      [destinationAccountId, '12500'],
    ]),
  );
});
