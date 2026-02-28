import { isInLastRanks, isInPromotionZone } from "./orientation";
import { type BoardMove, type Piece } from "./types";

const PROMOTABLE_PIECES: Piece["kind"][] = ["rook", "bishop", "silver", "knight", "lance", "pawn"];
const FORCE_PROMOTION_DEPTH: Partial<Record<Piece["kind"], number>> = {
  pawn: 1,
  lance: 1,
  knight: 2,
};

export function canPromote(piece: Piece): boolean {
  return PROMOTABLE_PIECES.includes(piece.kind);
}

export function canChoosePromotion(piece: Piece, move: BoardMove): boolean {
  if (piece.promoted || !canPromote(piece)) {
    return false;
  }

  return isInPromotionZone(piece.color, move.from.y) || isInPromotionZone(piece.color, move.to.y);
}

export function shouldAutoPromote(piece: Piece, move: BoardMove): boolean {
  const depth = FORCE_PROMOTION_DEPTH[piece.kind];
  if (!depth) {
    return false;
  }

  return isInLastRanks(piece.color, move.to.y, depth);
}

export function resolvePromotion(
  piece: Piece,
  move: BoardMove,
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
