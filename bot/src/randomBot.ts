import { generateLegalMoves } from "../../core/src/moveGenerator";
import { type GameState, type Move } from "../../core/src/types";

export function chooseRandomMove(state: GameState): Move | null {
  const legalMoves = generateLegalMoves(state);
  if (legalMoves.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * legalMoves.length);
  return legalMoves[index];
}
