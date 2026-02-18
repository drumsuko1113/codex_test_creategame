import { type CSSProperties } from "react";
import { type Color, type HandState, type PieceKind } from "../../../core/src/types";

type HandProps = {
  hands: HandState;
  color: Color;
  active: boolean;
  selectedDrop: PieceKind | null;
  onSelectDrop: (kind: PieceKind) => void;
};

const HAND_ORDER: PieceKind[] = ["rook", "bishop", "gold", "silver", "knight", "lance", "pawn"];

const PLAYER_LABEL: Record<Color, string> = {
  black: "先手",
  white: "後手",
};

const NORMAL_COLS: Record<PieceKind, number> = {
  king: 0,
  rook: 1,
  bishop: 2,
  gold: 3,
  silver: 4,
  knight: 5,
  lance: 6,
  pawn: 7,
};

function toPercent(index: number, maxIndex: number): string {
  if (maxIndex === 0) {
    return "0%";
  }
  return `${(index * 100) / maxIndex}%`;
}

function handPieceSpriteStyle(color: Color, kind: PieceKind): CSSProperties {
  const cols = 8;
  const rows = 4;
  const col = NORMAL_COLS[kind];
  const row = color === "black" ? 0 : 2;

  return {
    backgroundImage: 'url("/将棋駒.png")',
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${toPercent(col, cols - 1)} ${toPercent(row, rows - 1)}`,
  };
}

export function Hand({ hands, color, active, selectedDrop, onSelectDrop }: HandProps) {
  return (
    <aside className="hand-panel" aria-label={`${PLAYER_LABEL[color]}の持ち駒`}>
      <span className="hand-title">{PLAYER_LABEL[color]}の持ち駒</span>
      <div className="hand-pieces">
        {HAND_ORDER.map((kind) => {
          const count = hands[color][kind] ?? 0;
          const disabled = !active || count <= 0;
          const selected = active && selectedDrop === kind;

          return (
            <button
              key={`${color}-${kind}`}
              type="button"
              disabled={disabled}
              className={`hand-piece ${selected ? "is-selected" : ""}`.trim()}
              onClick={() => onSelectDrop(kind)}
            >
              <span className="hand-piece-icon" style={handPieceSpriteStyle(color, kind)} aria-hidden="true" />
              <span className="hand-piece-count">x{count}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
