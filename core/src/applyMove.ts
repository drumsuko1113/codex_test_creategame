import { type Move, type GameState, type Piece } from "./types";
import { isMoveLegal } from "./moveValidator";

type ApplyResult =
  | { ok: true; value: GameState }
  | { ok: false; reason: string };

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
  const movingPiece = nextBoard[move.from.y][move.from.x];

  if (!movingPiece) {
    return { ok: false, reason: "No piece found" };
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
    promoted: move.promote ?? movingPiece.promoted,
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
