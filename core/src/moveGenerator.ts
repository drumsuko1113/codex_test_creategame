import { forEachBoardPosition } from "./board";
import { HAND_PIECE_KINDS } from "./constants";
import { tryApplyMove } from "./moveExecutor";
import { canChoosePromotion, shouldAutoPromote } from "./promotion";
import { type BoardMove, type Move, type GameState } from "./types";

function pushIfApplicable(state: GameState, move: Move, moves: Move[]): void {
  if (tryApplyMove(state, move).ok) {
    moves.push(move);
  }
}

export function generateLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];

  forEachBoardPosition(({ x, y }) => {
    const piece = state.board[y][x];
    if (!piece || piece.color !== state.turn) {
      return;
    }

    forEachBoardPosition(({ x: toX, y: toY }) => {
      if (x === toX && y === toY) {
        return;
      }

      const baseMove: BoardMove = {
        from: { x, y },
        to: { x: toX, y: toY },
      };

      pushIfApplicable(state, baseMove, moves);

      if (!piece.promoted && canChoosePromotion(piece, baseMove) && !shouldAutoPromote(piece, baseMove)) {
        pushIfApplicable(state, { ...baseMove, promote: true }, moves);
      }
    });
  });

  const hand = state.hands[state.turn];
  for (const kind of HAND_PIECE_KINDS) {
    if ((hand[kind] ?? 0) <= 0) {
      continue;
    }

    forEachBoardPosition(({ x, y }) => {
      pushIfApplicable(
        state,
        {
          drop: kind,
          to: { x, y },
        },
        moves,
      );
    });
  }

  return moves;
}

export function generatePseudoLegalMoves(state: GameState): Move[] {
  return generateLegalMoves(state);
}
