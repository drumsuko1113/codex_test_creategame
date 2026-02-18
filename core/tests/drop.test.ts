import { describe, expect, it } from "vitest";
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

describe("drop move", () => {
  it("allows legal pawn drop from hand", () => {
    const state = createEmptyState("black");
    state.hands.black.pawn = 1;

    expect(isMoveLegal(state, { drop: "pawn", to: { x: 4, y: 4 } })).toBe(true);
  });

  it("rejects drop when piece is not in hand", () => {
    const state = createEmptyState("black");

    expect(isMoveLegal(state, { drop: "silver", to: { x: 4, y: 4 } })).toBe(false);
  });

  it("rejects pawn drop on file with own unpromoted pawn", () => {
    const state = createEmptyState("black");
    state.hands.black.pawn = 1;
    state.board[6][4] = piece("pawn", "black");

    expect(isMoveLegal(state, { drop: "pawn", to: { x: 4, y: 4 } })).toBe(false);
  });

  it("rejects knight drop on last two ranks", () => {
    const state = createEmptyState("black");
    state.hands.black.knight = 1;

    expect(isMoveLegal(state, { drop: "knight", to: { x: 4, y: 1 } })).toBe(false);
    expect(isMoveLegal(state, { drop: "knight", to: { x: 4, y: 0 } })).toBe(false);
  });

  it("rejects pawn-drop mate", () => {
    const state = createEmptyState("black");
    state.hands.black.pawn = 1;
    state.board[8][8] = piece("king", "black");
    state.board[0][0] = piece("king", "white");
    state.board[0][1] = piece("lance", "white");
    state.board[1][2] = piece("rook", "black");

    const result = applyMove(state, { drop: "pawn", to: { x: 0, y: 1 } });
    expect(result.ok).toBe(false);
  });

  it("applies non-mating pawn drop", () => {
    const state = createEmptyState("black");
    state.hands.black.pawn = 1;
    state.board[8][8] = piece("king", "black");
    state.board[0][0] = piece("king", "white");

    const result = applyMove(state, { drop: "pawn", to: { x: 4, y: 4 } });
    expect(result.ok).toBe(true);
  });

  it("applies drop move and decrements hand", () => {
    const state = createEmptyState("black");
    state.hands.black.gold = 1;

    const result = applyMove(state, { drop: "gold", to: { x: 3, y: 3 } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.board[3][3]).toEqual({ kind: "gold", color: "black", promoted: false });
      expect(result.value.hands.black.gold).toBe(0);
      expect(result.value.turn).toBe("white");
    }
  });
});
