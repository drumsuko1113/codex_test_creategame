import type { DropMove, Move } from "./types";

export function isDropMove(move: Move): move is DropMove {
  return "drop" in move;
}
