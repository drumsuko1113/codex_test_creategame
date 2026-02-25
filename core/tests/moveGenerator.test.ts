import { describe, expect, test } from "vitest";
import { applyMove } from "../src/applyMove";
import { createInitialGameState } from "../src/initialPosition";
import { generateLegalMoves } from "../src/moveGenerator";

describe("generateLegalMoves", () => {
  test("returns legal moves for current state", () => {
    const state = createInitialGameState();
    const moves = generateLegalMoves(state);

    expect(moves.length).toBeGreaterThan(0);

    for (const move of moves) {
      expect(applyMove(state, move).ok).toBe(true);
    }
  });

  test("does not contain duplicate move payloads", () => {
    const state = createInitialGameState();
    const moves = generateLegalMoves(state);
    const signatures = new Set(moves.map((move) => JSON.stringify(move)));

    expect(signatures.size).toBe(moves.length);
  });
});
