import { isKingInCheck } from "./check";
import { isDropMove } from "./move";
import { oppositeColor } from "./orientation";
import { resolvePromotion } from "./promotion";
import { isMoveLegal } from "./moveValidator";
import { type GameState, type Move, type Piece } from "./types";

export type ApplyResult =
  | { ok: true; value: GameState }
  | { ok: false; reason: string };

function demote(piece: Piece): Piece {
  return {
    ...piece,
    promoted: false,
  };
}

function finalizeMove(state: GameState, nextBoard: GameState["board"], nextHands: GameState["hands"]): ApplyResult {
  if (isKingInCheck({ board: nextBoard, hands: nextHands, turn: state.turn }, state.turn)) {
    return { ok: false, reason: "Move leaves king in check" };
  }

  return {
    ok: true,
    value: {
      board: nextBoard,
      hands: nextHands,
      turn: oppositeColor(state.turn),
    },
  };
}

export function tryApplyMove(state: GameState, move: Move): ApplyResult {
  if (!isMoveLegal(state, move)) {
    return { ok: false, reason: "Illegal move" };
  }

  const nextBoard = state.board.map((row) => row.slice());
  const nextHands = {
    black: { ...state.hands.black },
    white: { ...state.hands.white },
  };

  if (isDropMove(move)) {
    const handCount = nextHands[state.turn][move.drop] ?? 0;
    if (handCount <= 0) {
      return { ok: false, reason: "No piece in hand" };
    }

    nextHands[state.turn][move.drop] = handCount - 1;
    nextBoard[move.to.y][move.to.x] = {
      kind: move.drop,
      color: state.turn,
      promoted: false,
    };

    return finalizeMove(state, nextBoard, nextHands);
  }

  const movingPiece = nextBoard[move.from.y][move.from.x];

  if (!movingPiece) {
    return { ok: false, reason: "No piece found" };
  }

  const promotion = resolvePromotion(movingPiece, move);
  if (!promotion.ok) {
    return { ok: false, reason: promotion.reason };
  }

  const captured = nextBoard[move.to.y][move.to.x];
  if (captured) {
    const hand = nextHands[state.turn];
    const key = demote(captured).kind;
    hand[key] = (hand[key] ?? 0) + 1;
  }

  nextBoard[move.from.y][move.from.x] = null;
  nextBoard[move.to.y][move.to.x] = {
    ...movingPiece,
    promoted: promotion.promoted,
  };

  return finalizeMove(state, nextBoard, nextHands);
}
