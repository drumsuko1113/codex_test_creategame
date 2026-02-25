import { describe, expect, test, vi } from "vitest";
import { RateLimiter } from "../src/rateLimiter";

describe("RateLimiter", () => {
  test("cleans up stale buckets while processing new keys", () => {
    const nowSpy = vi.spyOn(Date, "now");
    const limiter = new RateLimiter(1_000, 10);

    nowSpy.mockReturnValue(0);
    expect(limiter.consume("ip-1")).toBe(true);
    expect(limiter.consume("ip-2")).toBe(true);

    nowSpy.mockReturnValue(2_000);
    expect(limiter.consume("ip-3")).toBe(true);

    const buckets = (limiter as unknown as { buckets: Map<string, unknown> }).buckets;
    expect(buckets.has("ip-1")).toBe(false);
    expect(buckets.has("ip-2")).toBe(false);
    expect(buckets.has("ip-3")).toBe(true);

    nowSpy.mockRestore();
  });

  test("still enforces per-window request limits", () => {
    const nowSpy = vi.spyOn(Date, "now");
    const limiter = new RateLimiter(1_000, 2);

    nowSpy.mockReturnValue(100);
    expect(limiter.consume("same-ip")).toBe(true);
    expect(limiter.consume("same-ip")).toBe(true);
    expect(limiter.consume("same-ip")).toBe(false);

    nowSpy.mockReturnValue(1_200);
    expect(limiter.consume("same-ip")).toBe(true);

    nowSpy.mockRestore();
  });
});
