import { describe, expect, test } from "vitest";
import { ApiClientError } from "../src/online/gameApi";
import { computePollingRetryDelayMs, isRetryableNetworkError } from "../src/online/networkRecovery";

describe("networkRecovery", () => {
  test("detects retryable network error from api client error", () => {
    expect(isRetryableNetworkError(new ApiClientError(0, "NETWORK_ERROR", "Network request failed"))).toBe(true);
    expect(isRetryableNetworkError(new ApiClientError(401, "UNAUTHORIZED", "Session token is invalid"))).toBe(false);
    expect(isRetryableNetworkError(new Error("boom"))).toBe(false);
  });

  test("applies exponential backoff with upper bound", () => {
    expect(computePollingRetryDelayMs(2000, 0)).toBe(2000);
    expect(computePollingRetryDelayMs(2000, 1)).toBe(4000);
    expect(computePollingRetryDelayMs(2000, 2)).toBe(8000);
    expect(computePollingRetryDelayMs(2000, 3)).toBe(15000);
    expect(computePollingRetryDelayMs(2000, 10)).toBe(15000);
  });

  test("treats negative failure count as zero", () => {
    expect(computePollingRetryDelayMs(3000, -1)).toBe(3000);
  });
});
