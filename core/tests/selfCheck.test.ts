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

describe("self-check prevention", () => {
  it("rejects move that exposes own king to rook", () => {
    const state = createEmptyState("black");
    state.board[8][4] = piece("king", "black");
    state.board[7][4] = piece("gold", "black");
    state.board[4][4] = piece("rook", "white");

    const result = applyMove(state, {
      from: { x: 4, y: 7 },
      to: { x: 3, y: 7 },
    });

    expect(result.ok).toBe(false);
  });

  it("allows move that blocks existing check", () => {
    const state = createEmptyState("black");
    state.board[8][4] = piece("king", "black");
    state.board[7][3] = piece("gold", "black");
    state.board[4][4] = piece("rook", "white");

    const result = applyMove(state, {
      from: { x: 3, y: 7 },
      to: { x: 4, y: 7 },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects drop that does not resolve check", () => {
    const state = createEmptyState("black");
    state.board[8][4] = piece("king", "black");
    state.board[4][4] = piece("rook", "white");
    state.hands.black.gold = 1;

    const result = applyMove(state, {
      drop: "gold",
      to: { x: 0, y: 0 },
    });

    expect(result.ok).toBe(false);
  });
});
