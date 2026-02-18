import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/initialPosition";
import { applyMove } from "../src/applyMove";
import { isMoveLegal } from "../src/moveValidator";
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

describe("isMoveLegal", () => {
  it("allows black pawn to move one step forward", () => {
    const state = createInitialGameState();
    expect(isMoveLegal(state, { from: { x: 4, y: 6 }, to: { x: 4, y: 5 } })).toBe(true);
  });

  it("rejects black pawn backward move", () => {
    const state = createInitialGameState();
    expect(isMoveLegal(state, { from: { x: 4, y: 6 }, to: { x: 4, y: 7 } })).toBe(false);
  });

  it("allows white pawn to move one step forward", () => {
    const state = createInitialGameState();
    state.turn = "white";
    expect(isMoveLegal(state, { from: { x: 4, y: 2 }, to: { x: 4, y: 3 } })).toBe(true);
  });

  it("rejects rook jump over piece", () => {
    const state = createInitialGameState();
    expect(isMoveLegal(state, { from: { x: 7, y: 7 }, to: { x: 7, y: 1 } })).toBe(false);
  });

  it("allows bishop diagonal move when path is clear", () => {
    const state = createEmptyState();
    state.board[4][4] = piece("bishop", "black");
    expect(isMoveLegal(state, { from: { x: 4, y: 4 }, to: { x: 6, y: 2 } })).toBe(true);
  });

  it("rejects lance move when blocked", () => {
    const state = createEmptyState();
    state.board[8][4] = piece("lance", "black");
    state.board[6][4] = piece("pawn", "black");
    expect(isMoveLegal(state, { from: { x: 4, y: 8 }, to: { x: 4, y: 5 } })).toBe(false);
  });

  it("treats promoted pawn as gold movement", () => {
    const state = createEmptyState();
    state.board[4][4] = piece("pawn", "black", true);

    expect(isMoveLegal(state, { from: { x: 4, y: 4 }, to: { x: 3, y: 5 } })).toBe(false);
    expect(isMoveLegal(state, { from: { x: 4, y: 4 }, to: { x: 4, y: 3 } })).toBe(true);
  });
});

describe("applyMove", () => {
  it("switches turn on legal move", () => {
    const state = createInitialGameState();
    const result = applyMove(state, { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.turn).toBe("white");
    }
  });
});
