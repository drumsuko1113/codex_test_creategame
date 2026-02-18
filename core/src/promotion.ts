import { type Move, type Piece } from "./types";

const PROMOTABLE_PIECES: Piece["kind"][] = ["rook", "bishop", "silver", "knight", "lance", "pawn"];

export function canPromote(piece: Piece): boolean {
  return PROMOTABLE_PIECES.includes(piece.kind);
}

export function shouldAutoPromote(piece: Piece, move: Move): boolean {
  if (piece.color === "black") {
    if (piece.kind === "pawn" || piece.kind === "lance") {
      return move.to.y === 0;
    }
    if (piece.kind === "knight") {
      return move.to.y <= 1;
    }
  } else {
    if (piece.kind === "pawn" || piece.kind === "lance") {
      return move.to.y === 8;
    }
    if (piece.kind === "knight") {
      return move.to.y >= 7;
    }
  }

  return false;
}
