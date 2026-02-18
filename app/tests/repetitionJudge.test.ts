import { describe, expect, it } from "vitest";
import { findPerpetualCheckLoser } from "../src/game/repetitionJudge";
import { type GameState } from "../../core/src/types";

function state(turn: "black" | "white"): GameState {
  return {
    board: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null)),
    hands: { black: {}, white: {} },
    turn,
  };
}

describe("findPerpetualCheckLoser", () => {
  it("returns attacker color when one side gives continuous checks", () => {
    const history = [state("black"), state("white"), state("black"), state("white"), state("black")];
    const checking = ["black", "black", "black", "black"] as const;

    expect(findPerpetualCheckLoser(history, [...checking], 0, 4)).toBe("black");
  });

  it("returns null when checks are not continuous by one side", () => {
    const history = [state("black"), state("white"), state("black"), state("white"), state("black")];
    const checking = ["black", "white", "black", "white"] as const;

    expect(findPerpetualCheckLoser(history, [...checking], 0, 4)).toBeNull();
  });
});
