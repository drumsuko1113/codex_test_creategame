import { describe, expect, test } from "vitest";
import { canOperateTurn, getTurnLockMessage } from "../src/game/turnControl";

describe("turnControl", () => {
  test("allows operation only when session seat matches current turn and state is active", () => {
    expect(
      canOperateTurn({
        screenMode: "game",
        sessionSeat: "black",
        turn: "black",
        gameOver: false,
        isPaused: false,
        pendingPromotion: false,
        isSubmittingMove: false,
        isSyncingSnapshot: false,
      }),
    ).toBe(true);
  });

  test("disables operation when it is not player's turn", () => {
    expect(
      canOperateTurn({
        screenMode: "game",
        sessionSeat: "black",
        turn: "white",
        gameOver: false,
        isPaused: false,
        pendingPromotion: false,
        isSubmittingMove: false,
        isSyncingSnapshot: false,
      }),
    ).toBe(false);
  });

  test("disables operation when no session exists or game is blocked", () => {
    expect(
      canOperateTurn({
        screenMode: "game",
        sessionSeat: null,
        turn: "black",
        gameOver: false,
        isPaused: false,
        pendingPromotion: false,
        isSubmittingMove: false,
        isSyncingSnapshot: false,
      }),
    ).toBe(false);

    expect(
      canOperateTurn({
        screenMode: "game",
        sessionSeat: "black",
        turn: "black",
        gameOver: false,
        isPaused: false,
        pendingPromotion: false,
        isSubmittingMove: true,
        isSyncingSnapshot: false,
      }),
    ).toBe(false);
  });

  test("returns lock message when waiting for opponent turn", () => {
    expect(
      getTurnLockMessage({
        screenMode: "game",
        sessionSeat: "black",
        turn: "white",
        gameOver: false,
        isPaused: false,
      }),
    ).toBe("現在は相手の手番です。操作を待機してください。");
  });

  test("returns null lock message when lock explanation is unnecessary", () => {
    expect(
      getTurnLockMessage({
        screenMode: "setup",
        sessionSeat: "black",
        turn: "white",
        gameOver: false,
        isPaused: false,
      }),
    ).toBeNull();

    expect(
      getTurnLockMessage({
        screenMode: "game",
        sessionSeat: "black",
        turn: "black",
        gameOver: false,
        isPaused: false,
      }),
    ).toBeNull();
  });
});
