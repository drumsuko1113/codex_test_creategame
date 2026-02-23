type Bucket = {
  startedAtMs: number;
  count: number;
};

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly windowMs: number,
    private readonly limit: number,
  ) {}

  consume(key: string): boolean {
    const now = Date.now();
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
