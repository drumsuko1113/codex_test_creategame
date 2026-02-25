import type { Color } from "../../../core/src/types";

type ScreenMode = "setup" | "game";

type TurnControlInput = {
  screenMode: ScreenMode;
  sessionSeat: Color | null;
  turn: Color;
  gameOver: boolean;
  isPaused: boolean;
  pendingPromotion: boolean;
  isSubmittingMove: boolean;
  isSyncingSnapshot: boolean;
};

type TurnLockMessageInput = {
  screenMode: ScreenMode;
  sessionSeat: Color | null;
  turn: Color;
  gameOver: boolean;
  isPaused: boolean;
};

export function canOperateTurn(input: TurnControlInput): boolean {
  return (
    input.screenMode === "game" &&
    input.sessionSeat !== null &&
    input.sessionSeat === input.turn &&
    !input.gameOver &&
    !input.isPaused &&
    !input.pendingPromotion &&
    !input.isSubmittingMove &&
    !input.isSyncingSnapshot
  );
}

export function getTurnLockMessage(input: TurnLockMessageInput): string | null {
  if (input.screenMode !== "game" || input.sessionSeat === null || input.gameOver || input.isPaused) {
    return null;
  }

  if (input.sessionSeat !== input.turn) {
    return "現在は相手の手番です。操作を待機してください。";
  }

  return null;
}
