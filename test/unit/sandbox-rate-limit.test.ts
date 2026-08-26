import { expect, test } from 'bun:test';
import { SandboxRateLimiter } from '../../src/sandbox/rate-limit.ts';

test('limits sandbox session bursts without retaining visitor data', () => {
  let now = 1_000;
  const limiter = new SandboxRateLimiter(2, 10_000, () => now);

  expect(limiter.consume()).toEqual({ allowed: true, retryAfterSeconds: 0 });
  expect(limiter.consume()).toEqual({ allowed: true, retryAfterSeconds: 0 });
  expect(limiter.consume()).toEqual({ allowed: false, retryAfterSeconds: 10 });

  now += 10_001;
  expect(limiter.consume()).toEqual({ allowed: true, retryAfterSeconds: 0 });
});
