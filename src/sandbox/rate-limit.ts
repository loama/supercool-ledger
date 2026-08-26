export interface SandboxRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class SandboxRateLimiter {
  private requests: number[] = [];

  constructor(
    private readonly maxRequests = 12,
    private readonly windowMilliseconds = 60_000,
    private readonly now: () => number = Date.now,
  ) {
    if (maxRequests < 1 || windowMilliseconds < 1) {
      throw new Error('invalid_sandbox_rate_limit');
    }
  }

  consume(): SandboxRateLimitDecision {
    const currentTime = this.now();
    const cutoff = currentTime - this.windowMilliseconds;
    this.requests = this.requests.filter((timestamp) => timestamp > cutoff);

    if (this.requests.length >= this.maxRequests) {
      const firstRequest = this.requests[0] ?? currentTime;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((firstRequest + this.windowMilliseconds - currentTime) / 1_000),
        ),
      };
    }

    this.requests.push(currentTime);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
