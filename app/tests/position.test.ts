import { describe, expect, test } from "vitest";
import { isSamePosition, positionToKey } from "../src/game/position";

describe("position helpers", () => {
  test("positionToKey creates stable coordinate key", () => {
    expect(positionToKey({ x: 0, y: 0 })).toBe("0:0");
    expect(positionToKey({ x: 8, y: 8 })).toBe("8:8");
  });

  test("isSamePosition compares both x and y", () => {
    expect(isSamePosition({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(isSamePosition({ x: 1, y: 2 }, { x: 2, y: 2 })).toBe(false);
    expect(isSamePosition({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
  });
});
