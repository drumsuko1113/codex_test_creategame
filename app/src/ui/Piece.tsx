import { type CSSProperties } from "react";
import { type Piece as PieceType } from "../../../core/src/types";
import { PIECE_SPRITE_PATH } from "../assets";

type PieceProps = {
  piece: PieceType;
};

type SpritePosition = {
  col: number;
  row: number;
};

const NORMAL_COLS: Record<PieceType["kind"], number> = {
  king: 0,
  rook: 1,
  bishop: 2,
  gold: 3,
  silver: 4,
  knight: 5,
  lance: 6,
  pawn: 7,
};

const PROMOTED_COLS: Partial<Record<PieceType["kind"], number>> = {
  rook: 1,
  bishop: 2,
  silver: 4,
  knight: 5,
  lance: 6,
  pawn: 7,
};

const COLS = 8;
const ROWS = 4;

function spritePosition(piece: PieceType): SpritePosition {
  const rowBase = piece.color === "black" ? 0 : 2;

  if (piece.promoted && PROMOTED_COLS[piece.kind] !== undefined) {
    return { col: PROMOTED_COLS[piece.kind] as number, row: rowBase + 1 };
  }

  return { col: NORMAL_COLS[piece.kind], row: rowBase };
}

function toPercent(index: number, maxIndex: number): string {
  if (maxIndex === 0) {
    return "0%";
  }
  return `${(index * 100) / maxIndex}%`;
}

export function Piece({ piece }: PieceProps) {
  const { col, row } = spritePosition(piece);
  const style: CSSProperties = {
    backgroundImage: `url("${PIECE_SPRITE_PATH}")`,
    backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
    backgroundPosition: `${toPercent(col, COLS - 1)} ${toPercent(row, ROWS - 1)}`,
  };

  return <span className="piece" style={style} aria-label={`${piece.color}-${piece.kind}${piece.promoted ? "-promoted" : ""}`} />;
}
