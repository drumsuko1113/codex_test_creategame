import { describe, expect, it } from "vitest";
import { formatClockText, projectClockState } from "../src/game/timeControl";

describe("timeControl helpers", () => {
  it("switches display to byo-yomi after main time reaches zero", () => {
    expect(formatClockText(125, 30)).toBe("02:05");
    expect(formatClockText(0, 30)).toBe("秒読み 00:30");
  });

  it("projects active turn clock by elapsed seconds", () => {
    const projected = projectClockState(
      {
        main: { black: 100, white: 100 },
        byo: { black: 30, white: 30 },
      },
      "black",
      1_000_000,
      1_004_000,
    );

    expect(projected.main.black).toBe(96);
    expect(projected.main.white).toBe(100);
    expect(projected.byo.black).toBe(30);
  });

  it("counts down byo-yomi after main time is exhausted", () => {
    const projected = projectClockState(
      {
        main: { black: 0, white: 100 },
        byo: { black: 30, white: 30 },
      },
      "black",
      1_000_000,
      1_010_000,
    );

    expect(projected.main.black).toBe(0);
    expect(projected.byo.black).toBe(20);
  });
});
