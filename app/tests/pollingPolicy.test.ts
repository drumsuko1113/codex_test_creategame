import { describe, expect, test } from "vitest";
import { getPollingIntervalMs, shouldApplySnapshot } from "../src/online/pollingPolicy";

describe("polling policy", () => {
  test("uses 2 seconds when page is visible", () => {
    expect(getPollingIntervalMs(false)).toBe(2000);
  });

  test("uses 3 seconds when page is hidden", () => {
    expect(getPollingIntervalMs(true)).toBe(3000);
  });

  test("applies snapshot only when version increases", () => {
    expect(shouldApplySnapshot(3, 3)).toBe(false);
    expect(shouldApplySnapshot(4, 3)).toBe(false);
    expect(shouldApplySnapshot(3, 4)).toBe(true);
  });
});
