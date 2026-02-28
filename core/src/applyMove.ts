import { isCheckmate } from "./checkmate";
import { isDropMove } from "./move";
import { tryApplyMove, type ApplyResult } from "./moveExecutor";
import { type GameState, type Move } from "./types";

function isPawnDrop(move: Move): boolean {
  return isDropMove(move) && move.drop === "pawn";
}

export function applyMove(state: GameState, move: Move): ApplyResult {
  const result = tryApplyMove(state, move);
  if (!result.ok) {
    return result;
  }

  if (isPawnDrop(move) && isCheckmate(result.value)) {
    return { ok: false, reason: "Pawn-drop mate is not allowed" };
  }

  return result;
}
