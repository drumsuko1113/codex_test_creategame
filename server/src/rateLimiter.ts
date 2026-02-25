type Bucket = {
  startedAtMs: number;
  count: number;
};

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastCleanupAtMs = 0;

  constructor(
    private readonly windowMs: number,
    private readonly limit: number,
  ) {}

  private cleanupExpired(now: number): void {
    if (now - this.lastCleanupAtMs < this.windowMs) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.startedAtMs >= this.windowMs) {
        this.buckets.delete(key);
      }
    }
    this.lastCleanupAtMs = now;
  }

  consume(key: string): boolean {
    const now = Date.now();
    this.cleanupExpired(now);
    const current = this.buckets.get(key);
    if (!current || now - current.startedAtMs >= this.windowMs) {
      this.buckets.set(key, { startedAtMs: now, count: 1 });
      return true;
    }

    if (current.count >= this.limit) {
      return false;
    }

    current.count += 1;
    this.buckets.set(key, current);
    return true;
  }
}
