import { type Piece as PieceType } from "../../../core/src/types";

type PieceProps = {
  piece: PieceType;
};

const NORMAL_LABELS: Record<PieceType["kind"], string> = {
  king: "王",
  rook: "飛",
  bishop: "角",
  gold: "金",
  silver: "銀",
  knight: "桂",
  lance: "香",
  pawn: "歩",
};

const PROMOTED_LABELS: Partial<Record<PieceType["kind"], string>> = {
  rook: "龍",
  bishop: "馬",
  silver: "全",
  knight: "圭",
  lance: "杏",
  pawn: "と",
};

function labelForPiece(piece: PieceType): string {
  if (piece.promoted && PROMOTED_LABELS[piece.kind]) {
    return PROMOTED_LABELS[piece.kind] as string;
  }
  return NORMAL_LABELS[piece.kind];
}

export function Piece({ piece }: PieceProps) {
  const className = `piece piece-${piece.color}`;

  return <span className={className}>{labelForPiece(piece)}</span>;
}
