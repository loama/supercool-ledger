import { jwtVerify, SignJWT } from 'jose';
import type { AuthContext } from './context.ts';

export interface DevelopmentClaims {
  subject: string;
  tenantId: string;
  scopes: string[];
}

const key = (secret: string): Uint8Array => {
  if (secret.length < 32) throw new Error('auth_secret_too_short');
  return new TextEncoder().encode(secret);
};

export const signDevelopmentToken = async (
  claims: DevelopmentClaims,
  secret: string,
): Promise<string> =>
  new SignJWT({ tenant_id: claims.tenantId, scope: claims.scopes })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.subject)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(key(secret));

export const verifyToken = async (
  token: string,
  secrets: string | readonly string[],
): Promise<AuthContext> => {
  const candidates = typeof secrets === 'string' ? [secrets] : secrets;
  let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'] | undefined;
  for (const secret of candidates) {
    try {
      payload = (await jwtVerify(token, key(secret), { algorithms: ['HS256'] })).payload;
      break;
    } catch {
      continue;
    }
  }
  if (!payload) throw new Error('invalid_token_signature');
  if (
    !payload.sub ||
    typeof payload.tenant_id !== 'string' ||
    !Array.isArray(payload.scope) ||
    payload.scope.some((scope) => typeof scope !== 'string')
  ) {
    throw new Error('invalid_token_claims');
  }
  return {
    subject: payload.sub,
    tenantId: payload.tenant_id,
    scopes: payload.scope as string[],
  };
};
