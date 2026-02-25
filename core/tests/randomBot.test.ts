import { describe, expect, test } from "vitest";
import { applyMove } from "../src/applyMove";
import { createInitialGameState } from "../src/initialPosition";
import { chooseRandomMove } from "../../bot/src/randomBot";

describe("chooseRandomMove", () => {
  test("returns a legal move when legal moves exist", () => {
    const state = createInitialGameState();

    for (let i = 0; i < 20; i += 1) {
      const move = chooseRandomMove(state);
      expect(move).not.toBeNull();
      if (move) {
        expect(applyMove(state, move).ok).toBe(true);
      }
    }
  });
});
