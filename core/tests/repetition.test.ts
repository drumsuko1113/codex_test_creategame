import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/initialPosition";
import { countSamePosition, isFourfoldRepetition, judgeRepetition } from "../src/repetition";
import { type GameState, type Piece } from "../src/types";

function cloneState(state: GameState): GameState {
  return {
    board: state.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    hands: {
      black: { ...state.hands.black },
      white: { ...state.hands.white },
    },
    turn: state.turn,
  };
}

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

describe("repetition", () => {
  it("counts identical positions including turn and hands", () => {
    const base = createInitialGameState();
    const same = cloneState(base);
    const differentTurn = cloneState(base);
    differentTurn.turn = "white";

    const history = [base, same, differentTurn];

    expect(countSamePosition(history, base)).toBe(2);
  });

  it("returns false when repetition is below fourfold", () => {
    const base = createInitialGameState();
    const history = [cloneState(base), cloneState(base), cloneState(base)];

    expect(isFourfoldRepetition(history)).toBe(false);
  });

  it("returns true when latest position appears four times", () => {
    const base = createInitialGameState();
    const history = [cloneState(base), cloneState(base), cloneState(base), cloneState(base)];

    expect(isFourfoldRepetition(history)).toBe(true);
  });

  it("judges normal fourfold repetition as draw", () => {
    const repeated = createEmptyState("black");
    repeated.board[8][4] = piece("king", "black");
    repeated.board[0][4] = piece("king", "white");

    const otherTurn = cloneState(repeated);
    otherTurn.turn = "white";

    const history = [repeated, otherTurn, cloneState(repeated), cloneState(otherTurn), cloneState(repeated), cloneState(otherTurn), cloneState(repeated)];

    expect(judgeRepetition(history)).toEqual({ kind: "draw" });
  });

  it("judges perpetual-check repetition as foul loss", () => {
    const checked = createEmptyState("white");
    checked.board[0][0] = piece("king", "white");
    checked.board[8][8] = piece("king", "black");
    checked.board[2][0] = piece("rook", "black");

    const attackerTurn = cloneState(checked);
    attackerTurn.turn = "black";

    const history = [checked, attackerTurn, cloneState(checked), cloneState(attackerTurn), cloneState(checked), cloneState(attackerTurn), cloneState(checked)];

    expect(judgeRepetition(history)).toEqual({ kind: "perpetual-check-loss", loser: "black" });
  });

  it("returns none for empty history", () => {
    expect(judgeRepetition([])).toEqual({ kind: "none" });
  });
});
