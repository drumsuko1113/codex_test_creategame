import { applyMove } from "./applyMove";
import { isInCheck } from "./check";
import { type GameState, type PieceKind } from "./types";

const HAND_PIECE_KINDS: PieceKind[] = ["rook", "bishop", "gold", "silver", "knight", "lance", "pawn"];

function hasAnyLegalMove(state: GameState): boolean {
  for (let y = 0; y < 9; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const piece = state.board[y][x];
      if (!piece || piece.color !== state.turn) {
        continue;
      }

      for (let toY = 0; toY < 9; toY += 1) {
        for (let toX = 0; toX < 9; toX += 1) {
          if (toX === x && toY === y) {
            continue;
          }

          const normalResult = applyMove(state, {
            from: { x, y },
            to: { x: toX, y: toY },
          });

          if (normalResult.ok) {
            return true;
          }

          const promoteResult = applyMove(state, {
            from: { x, y },
            to: { x: toX, y: toY },
            promote: true,
          });

          if (promoteResult.ok) {
            return true;
          }
        }
      }
    }
  }

  const hand = state.hands[state.turn];
  for (const kind of HAND_PIECE_KINDS) {
    if ((hand[kind] ?? 0) <= 0) {
      continue;
    }

    for (let y = 0; y < 9; y += 1) {
      for (let x = 0; x < 9; x += 1) {
        const dropResult = applyMove(state, {
          drop: kind,
          to: { x, y },
        });

        if (dropResult.ok) {
          return true;
        }
      }
    }
  }

  return false;
}

export function isCheckmate(state: GameState): boolean {
  if (!isInCheck(state)) {
    return false;
  }

  return !hasAnyLegalMove(state);
}
