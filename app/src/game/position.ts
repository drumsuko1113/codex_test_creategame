import type { Position } from "../../../core/src/types";

export function positionToKey(position: Position): string {
  return `${position.x}:${position.y}`;
}

export function isSamePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
