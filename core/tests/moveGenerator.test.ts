import { describe, expect, test } from "vitest";
import { applyMove } from "../src/applyMove";
import { createInitialGameState } from "../src/initialPosition";
import { type GameState, type Piece } from "../src/types";
import { generateLegalMoves } from "../src/moveGenerator";

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

  test("excludes pawn-drop mate from generated legal moves", () => {
    const state = createEmptyState("black");
    state.hands.black.pawn = 1;
    state.board[8][8] = piece("king", "black");
    state.board[0][0] = piece("king", "white");
    state.board[0][1] = piece("lance", "white");
    state.board[1][2] = piece("rook", "black");

    const moves = generateLegalMoves(state);

    expect(moves).not.toContainEqual({ drop: "pawn", to: { x: 0, y: 1 } });
  });
});
