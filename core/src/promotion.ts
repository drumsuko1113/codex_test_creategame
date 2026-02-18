import { type Move, type Piece } from "./types";

const PROMOTABLE_PIECES: Piece["kind"][] = ["rook", "bishop", "silver", "knight", "lance", "pawn"];

export function canPromote(piece: Piece): boolean {
  return PROMOTABLE_PIECES.includes(piece.kind);
}

function isInPromotionZone(piece: Piece, y: number): boolean {
  return piece.color === "black" ? y <= 2 : y >= 6;
}

export function canChoosePromotion(piece: Piece, move: Move): boolean {
  if (piece.promoted || !canPromote(piece)) {
    return false;
  }

  return isInPromotionZone(piece, move.from.y) || isInPromotionZone(piece, move.to.y);
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

export function resolvePromotion(
  piece: Piece,
  move: Move,
): { ok: true; promoted: boolean } | { ok: false; reason: string } {
  if (!canPromote(piece)) {
    if (move.promote) {
      return { ok: false, reason: "Piece cannot promote" };
    }
    return { ok: true, promoted: piece.promoted };
  }

  if (piece.promoted) {
    return { ok: true, promoted: true };
  }

  if (shouldAutoPromote(piece, move)) {
    return { ok: true, promoted: true };
  }

  if (move.promote) {
    if (!canChoosePromotion(piece, move)) {
      return { ok: false, reason: "Promotion is not available for this move" };
    }
    return { ok: true, promoted: true };
  }

  return { ok: true, promoted: false };
}
