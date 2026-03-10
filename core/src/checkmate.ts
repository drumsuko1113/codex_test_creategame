import { isInCheck } from "./check";
import { hasAnyPseudoLegalMove } from "./moveGenerator";
import { type GameState } from "./types";

export function isCheckmate(state: GameState): boolean {
  if (!isInCheck(state)) {
    return false;
  }

  return !hasAnyPseudoLegalMove(state);
}
