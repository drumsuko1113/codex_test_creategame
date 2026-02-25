import { isInCheck } from "./check";
import { generateLegalMoves } from "./moveGenerator";
import { type GameState } from "./types";

export function isCheckmate(state: GameState): boolean {
  if (!isInCheck(state)) {
    return false;
  }

  return generateLegalMoves(state).length === 0;
}
