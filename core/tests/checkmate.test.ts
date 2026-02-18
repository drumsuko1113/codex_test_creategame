import { describe, expect, it } from "vitest";
import { isCheckmate } from "../src/checkmate";
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

describe("checkmate", () => {
  it("returns false when side to move is not in check", () => {
    const state = createEmptyState("black");
    state.board[8][4] = piece("king", "black");
    state.board[0][4] = piece("king", "white");

    expect(isCheckmate(state)).toBe(false);
  });

  it("returns false when in check but has an escape", () => {
    const state = createEmptyState("black");
    state.board[8][0] = piece("king", "black");
    state.board[6][0] = piece("rook", "white");

    expect(isCheckmate(state)).toBe(false);
  });

  it("returns true when in check and no legal responses exist", () => {
    const state = createEmptyState("black");
    state.board[8][0] = piece("king", "black");
    state.board[6][0] = piece("rook", "white");
    state.board[7][2] = piece("bishop", "white");
    state.board[6][2] = piece("bishop", "white");

    expect(isCheckmate(state)).toBe(true);
  });
});
