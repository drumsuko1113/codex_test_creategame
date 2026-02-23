import { BOARD_SIZE } from "./constants";
import type { Position } from "./types";

export function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

export function forEachBoardPosition(visitor: (position: Position) => void | false): void {
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (visitor({ x, y }) === false) {
        return;
      }
    }
  }
}
