import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/initialPosition";
import { gameStateToSfen, sfenToGameState } from "../src/sfen";

describe("sfen", () => {
  it("serializes initial position", () => {
    const state = createInitialGameState();
    const sfen = gameStateToSfen(state);

    expect(sfen).toBe("lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1");
  });

  it("parses and serializes with promoted pieces and hands", () => {
    const sfen = "+P8/9/9/9/4k4/9/9/9/4K4 w 2R3p 1";

    const state = sfenToGameState(sfen);
    expect(state.turn).toBe("white");
    expect(state.board[0][0]?.kind).toBe("pawn");
    expect(state.board[0][0]?.promoted).toBe(true);
    expect(state.hands.black.rook).toBe(2);
    expect(state.hands.white.pawn).toBe(3);

    expect(gameStateToSfen(state)).toBe(sfen);
  });

  it("round-trips initial position", () => {
    const initial = createInitialGameState();
    const serialized = gameStateToSfen(initial);
    const parsed = sfenToGameState(serialized);

    expect(gameStateToSfen(parsed)).toBe(serialized);
  });
});
