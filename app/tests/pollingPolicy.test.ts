import { describe, expect, test } from "vitest";
import { shouldApplySnapshot } from "../src/online/pollingPolicy";

describe("polling policy", () => {
  test("applies snapshot only when version increases", () => {
    expect(shouldApplySnapshot(3, 3)).toBe(false);
    expect(shouldApplySnapshot(4, 3)).toBe(false);
    expect(shouldApplySnapshot(3, 4)).toBe(true);
  });
});
