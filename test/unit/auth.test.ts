import { expect, test } from 'bun:test';
import { signDevelopmentToken, verifyToken } from '../../src/auth/token.ts';

const secret = 'a-development-secret-with-more-than-32-characters';

test('signs and verifies tenant scoped claims', async () => {
  const token = await signDevelopmentToken(
    {
      subject: 'reviewer',
      tenantId: '9b858d3a-0976-4ed8-92a5-b07e2db8853f',
      scopes: ['accounts:read', 'transfers:write'],
    },
    secret,
  );

  expect(await verifyToken(token, secret)).toMatchObject({
    subject: 'reviewer',
    tenantId: '9b858d3a-0976-4ed8-92a5-b07e2db8853f',
    scopes: ['accounts:read', 'transfers:write'],
  });
});

test('rejects a token signed with another secret', async () => {
  const token = await signDevelopmentToken(
    {
      subject: 'reviewer',
      tenantId: '9b858d3a-0976-4ed8-92a5-b07e2db8853f',
      scopes: ['accounts:read'],
    },
    secret,
  );

  let caught: unknown;
  try {
    await verifyToken(token, `${secret}-different`);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeDefined();
});

test('accepts current and secondary secrets during rotation', async () => {
  const secondarySecret = 'a-secondary-secret-with-more-than-32-characters';
  const token = await signDevelopmentToken(
    {
      subject: 'reviewer',
      tenantId: '9b858d3a-0976-4ed8-92a5-b07e2db8853f',
      scopes: ['accounts:read'],
    },
    secondarySecret,
  );

  expect(await verifyToken(token, [secret, secondarySecret])).toMatchObject({
    subject: 'reviewer',
    tenantId: '9b858d3a-0976-4ed8-92a5-b07e2db8853f',
  });
});
