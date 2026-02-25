import { describe, expect, test } from "vitest";
import type { GameState } from "../../core/src/types";
import { buildResultText, toClockState, type GameSnapshot } from "../src/online/gameSnapshot";

const baseState = {
  board: [],
  hands: { black: {}, white: {} },
  turn: "black",
} as unknown as GameState;

function createSnapshot(partial: Partial<GameSnapshot>): GameSnapshot {
  return {
    id: "game-1",
    status: "active",
    turn: "black",
    state: baseState,
    mainSecondsBlack: 300,
    mainSecondsWhite: 300,
    byoSecondsBlack: 30,
    byoSecondsWhite: 30,
    resultType: null,
    winner: null,
    version: 1,
    turnStartedAtMs: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("toClockState", () => {
  test("maps server snapshot clocks to UI clock state", () => {
    const clock = toClockState(
      createSnapshot({
        mainSecondsBlack: 123,
        mainSecondsWhite: 45,
        byoSecondsBlack: 30,
        byoSecondsWhite: 10,
      }),
    );

    expect(clock).toEqual({
      main: { black: 123, white: 45 },
      byo: { black: 30, white: 10 },
    });
  });
});

describe("buildResultText", () => {
  test("returns null when game is not finished", () => {
    expect(buildResultText(createSnapshot({ status: "active" }))).toBeNull();
  });

  test("formats resign result", () => {
    const text = buildResultText(
      createSnapshot({
        status: "finished",
        winner: "white",
        resultType: "resign",
      }),
    );

    expect(text).toBe("後手の勝ち（投了）");
  });

  test("formats timeout result", () => {
    const text = buildResultText(
      createSnapshot({
        status: "finished",
        winner: "black",
        resultType: "timeout",
      }),
    );

    expect(text).toBe("先手の勝ち（時間切れ）");
  });
});
