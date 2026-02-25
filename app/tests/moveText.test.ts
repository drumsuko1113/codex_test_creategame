import { describe, expect, test } from "vitest";
import { createInitialGameState } from "../../core/src/initialPosition";
import { formatMoveText, oppositeColor, sideLabel, winnerLabel } from "../src/game/moveText";

describe("moveText helpers", () => {
  test("oppositeColor flips seat color", () => {
    expect(oppositeColor("black")).toBe("white");
    expect(oppositeColor("white")).toBe("black");
  });

  test("sideLabel and winnerLabel return non-empty labels per side", () => {
    const blackSide = sideLabel("black");
    const whiteSide = sideLabel("white");
    const blackWinner = winnerLabel("black");
    const whiteWinner = winnerLabel("white");

    expect(blackSide.length).toBeGreaterThan(0);
    expect(whiteSide.length).toBeGreaterThan(0);
    expect(blackWinner.length).toBeGreaterThan(0);
    expect(whiteWinner.length).toBeGreaterThan(0);
    expect(blackSide).not.toBe(whiteSide);
    expect(blackWinner).not.toBe(whiteWinner);
  });

  test("formatMoveText includes source coordinates for board moves", () => {
    const state = createInitialGameState();
    const text = formatMoveText(state, { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } }, null);

    expect(text).toContain("(");
    expect(text).toContain(")");
  });

  test("formatMoveText for drops omits source coordinate suffix", () => {
    const state = createInitialGameState();
    const text = formatMoveText(state, { drop: "pawn", to: { x: 4, y: 4 } }, null);

    expect(text).not.toContain("(");
    expect(text).not.toContain(")");
  });
});
