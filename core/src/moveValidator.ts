import { type Move, type GameState } from "./types";

export function isMoveLegal(state: GameState, move: Move): boolean {
  const piece = state.board[move.from.y]?.[move.from.x];
  if (!piece) {
    return false;
  }

  if (piece.color !== state.turn) {
    return false;
  }

  const target = state.board[move.to.y]?.[move.to.x];
  if (target?.color === piece.color) {
    return false;
  }

  // TODO: Replace with full shogi legal move generation.
  return true;
}
