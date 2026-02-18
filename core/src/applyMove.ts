import { type Move, type GameState, type Piece } from "./types";
import { isMoveLegal } from "./moveValidator";
import { resolvePromotion } from "./promotion";

type ApplyResult =
  | { ok: true; value: GameState }
  | { ok: false; reason: string };

function isDropMove(move: Move): move is Extract<Move, { drop: Piece["kind"] }> {
  return "drop" in move;
}

function demote(piece: Piece): Piece {
  return {
    ...piece,
    promoted: false,
  };
}

function flipTurn(current: GameState["turn"]): GameState["turn"] {
  return current === "black" ? "white" : "black";
}

export function applyMove(state: GameState, move: Move): ApplyResult {
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

    return {
      ok: true,
      value: {
        board: nextBoard,
        hands: nextHands,
        turn: flipTurn(state.turn),
      },
    };
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

  return {
    ok: true,
    value: {
      board: nextBoard,
      hands: nextHands,
      turn: flipTurn(state.turn),
    },
  };
}
