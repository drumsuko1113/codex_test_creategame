import { isMoveLegal } from "./moveValidator";
import { type Color, type GameState, type Position } from "./types";

function findKingPosition(state: GameState, color: Color): Position | null {
  for (let y = 0; y < state.board.length; y += 1) {
    for (let x = 0; x < state.board[y].length; x += 1) {
      const piece = state.board[y][x];
      if (piece?.kind === "king" && piece.color === color) {
        return { x, y };
      }
    }
  }
  return null;
}

export function isKingInCheck(state: GameState, kingColor: Color): boolean {
  const kingPosition = findKingPosition(state, kingColor);
  if (!kingPosition) {
    return false;
  }

  const attackerColor: Color = kingColor === "black" ? "white" : "black";
  const attackerState: GameState = {
    ...state,
    turn: attackerColor,
  };

  for (let y = 0; y < attackerState.board.length; y += 1) {
    for (let x = 0; x < attackerState.board[y].length; x += 1) {
      const piece = attackerState.board[y][x];
      if (!piece || piece.color !== attackerColor) {
        continue;
      }

      if (
        isMoveLegal(attackerState, {
          from: { x, y },
          to: kingPosition,
        })
      ) {
        return true;
      }
    }
  }

  return false;
}

export function isInCheck(state: GameState): boolean {
  return isKingInCheck(state, state.turn);
}
