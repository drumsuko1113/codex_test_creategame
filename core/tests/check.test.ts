import { describe, expect, it } from "vitest";
import { isInCheck, isKingInCheck } from "../src/check";
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

describe("check", () => {
  it("returns true when black king is attacked by white rook", () => {
    const state = createEmptyState("black");
    state.board[8][4] = piece("king", "black");
    state.board[4][4] = piece("rook", "white");

    expect(isKingInCheck(state, "black")).toBe(true);
    expect(isInCheck(state)).toBe(true);
  });

  it("returns false when attack path is blocked", () => {
    const state = createEmptyState("black");
    state.board[8][4] = piece("king", "black");
    state.board[4][4] = piece("rook", "white");
    state.board[6][4] = piece("pawn", "white");

    expect(isKingInCheck(state, "black")).toBe(false);
  });

  it("detects check for white king", () => {
    const state = createEmptyState("white");
    state.board[0][4] = piece("king", "white");
    state.board[3][1] = piece("bishop", "black");

    expect(isKingInCheck(state, "white")).toBe(true);
    expect(isInCheck(state)).toBe(true);
  });

  it("returns false when side to move is not in check", () => {
    const state = createEmptyState("white");
    state.board[0][4] = piece("king", "white");
    state.board[8][4] = piece("king", "black");
    state.board[4][4] = piece("rook", "white");

    expect(isInCheck(state)).toBe(false);
    expect(isKingInCheck(state, "black")).toBe(true);
  });
});
