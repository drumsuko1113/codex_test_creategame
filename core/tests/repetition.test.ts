import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/initialPosition";
import { countSamePosition, isFourfoldRepetition } from "../src/repetition";
import { type GameState } from "../src/types";

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

  it("returns false for empty history", () => {
    expect(isFourfoldRepetition([])).toBe(false);
  });
});
