import { describe, expect, it } from "vitest";
import { applyMove } from "../src/applyMove";
import { type GameState, type Piece } from "../src/types";

function createEmptyState(turn: GameState["turn"] = "black"): GameState {
  return {
    board: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null)),
    hands: { black: {}, white: {} },
    turn,
  };
}

function piece(kind: Piece["kind"], color: Piece["color"], promoted = false): Piece {
  return { kind, color, promoted };
}

describe("applyMove promotion", () => {
  it("promotes when requested in promotion zone", () => {
    const state = createEmptyState("black");
    state.board[3][4] = piece("pawn", "black");

    const result = applyMove(state, {
      from: { x: 4, y: 3 },
      to: { x: 4, y: 2 },
      promote: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.board[2][4]?.promoted).toBe(true);
    }
  });

  it("forces promotion on last rank for pawn", () => {
    const state = createEmptyState("black");
    state.board[1][4] = piece("pawn", "black");

    const result = applyMove(state, {
      from: { x: 4, y: 1 },
      to: { x: 4, y: 0 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.board[0][4]?.promoted).toBe(true);
    }
  });

  it("rejects promotion request outside promotion zone", () => {
    const state = createEmptyState("black");
    state.board[6][4] = piece("pawn", "black");

    const result = applyMove(state, {
      from: { x: 4, y: 6 },
      to: { x: 4, y: 5 },
      promote: true,
    });

    expect(result.ok).toBe(false);
  });

  it("rejects promotion request for non-promotable piece", () => {
    const state = createEmptyState("black");
    state.board[6][4] = piece("gold", "black");

    const result = applyMove(state, {
      from: { x: 4, y: 6 },
      to: { x: 4, y: 5 },
      promote: true,
    });

    expect(result.ok).toBe(false);
  });
});
