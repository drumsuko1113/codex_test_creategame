import { BOARD_SIZE } from "./constants";
import type { Color } from "./types";

export function oppositeColor(color: Color): Color {
  return color === "black" ? "white" : "black";
}

export function forwardDistance(color: Color, fromY: number, toY: number): number {
  return color === "black" ? fromY - toY : toY - fromY;
}

export function isInPromotionZone(color: Color, y: number): boolean {
  return color === "black" ? y <= 2 : y >= BOARD_SIZE - 3;
}

export function isInLastRanks(color: Color, y: number, depth: number): boolean {
  if (depth <= 0) {
    return false;
  }
  return color === "black" ? y <= depth - 1 : y >= BOARD_SIZE - depth;
}
