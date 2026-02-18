import { type Piece as PieceType } from "../../../core/src/types";

type PieceProps = {
  piece: PieceType;
};

const PIECE_LABELS: Record<PieceType["kind"], string> = {
  king: "K",
  rook: "R",
  bishop: "B",
  gold: "G",
  silver: "S",
  knight: "N",
  lance: "L",
  pawn: "P",
};

export function Piece({ piece }: PieceProps) {
  const className = `piece piece-${piece.color}`;
  const promoted = piece.promoted ? "+" : "";

  return <span className={className}>{promoted + PIECE_LABELS[piece.kind]}</span>;
}
