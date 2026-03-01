import { BOARD_SIZE } from "../../../core/src/constants";
import type { Color, Position } from "../../../core/src/types";

function getMirroredCoordinate(value: number): number {
  return BOARD_SIZE - 1 - value;
}

export function positionToKey(position: Position): string {
  return `${position.x}:${position.y}`;
}

export function isSamePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function toBoardPosition(displayPosition: Position, perspective: Color): Position {
  if (perspective === "black") {
    return displayPosition;
  }

  return {
    x: getMirroredCoordinate(displayPosition.x),
    y: getMirroredCoordinate(displayPosition.y),
  };
}

export function toDisplayPosition(boardPosition: Position, perspective: Color): Position {
  return toBoardPosition(boardPosition, perspective);
}
