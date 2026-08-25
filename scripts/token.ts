import { signDevelopmentToken } from '../src/auth/token.ts';

const secret = process.env.AUTH_SECRET;
const tenantId = process.argv[2];
if (!secret) throw new Error('missing_environment:AUTH_SECRET');
if (!tenantId) throw new Error('usage:bun scripts/token.ts TENANT_ID');

const token = await signDevelopmentToken(
  {
    subject: 'local-reviewer',
    tenantId,
    scopes: ['accounts:read', 'accounts:write', 'transfers:read', 'transfers:write'],
  },
  secret,
);
process.stdout.write(`${token}\n`);
