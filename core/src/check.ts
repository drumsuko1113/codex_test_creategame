import { forEachBoardPosition } from "./board";
import { isMoveLegal } from "./moveValidator";
import { oppositeColor } from "./orientation";
import { type Color, type GameState, type Position } from "./types";

export function findKingPosition(state: GameState, color: Color): Position | null {
  let king: Position | null = null;

  forEachBoardPosition(({ x, y }) => {
    if (king) {
      return false;
    }

    const piece = state.board[y][x];
    if (piece?.kind === "king" && piece.color === color) {
      king = { x, y };
      return false;
    }
  });

  return king;
}

export function isKingInCheck(state: GameState, kingColor: Color): boolean {
  const kingPosition = findKingPosition(state, kingColor);
  if (!kingPosition) {
    return false;
  }

  const attackerColor = oppositeColor(kingColor);
  const attackerState: GameState = {
    ...state,
    turn: attackerColor,
  };

  let inCheck = false;

  forEachBoardPosition(({ x, y }) => {
    if (inCheck) {
      return false;
    }

    const piece = attackerState.board[y][x];
    if (!piece || piece.color !== attackerColor) {
      return;
    }

    if (
      isMoveLegal(attackerState, {
        from: { x, y },
        to: kingPosition,
      })
    ) {
      inCheck = true;
      return false;
    }
  });

  return inCheck;
}

export function isInCheck(state: GameState): boolean {
  return isKingInCheck(state, state.turn);
}
