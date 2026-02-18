import { describe, expect, it } from "vitest";
import { formatClockText, normalizeTimeControl } from "../src/game/timeControl";

describe("timeControl helpers", () => {
  it("normalizes user input by minute and 10-second units", () => {
    expect(normalizeTimeControl(5.8, 37)).toEqual({ mainSeconds: 300, byoSeconds: 30 });
    expect(normalizeTimeControl(-2, -1)).toEqual({ mainSeconds: 0, byoSeconds: 0 });
  });

  it("switches display to byo-yomi after main time reaches zero", () => {
    expect(formatClockText(125, 30)).toBe("02:05");
    expect(formatClockText(0, 30)).toBe("秒読み 00:30");
  });
});
