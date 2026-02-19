import { type Color, type HandState, type PieceKind } from "../../../core/src/types";
import { Piece } from "./Piece";

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
              <span className="hand-piece-icon" aria-hidden="true">
                <Piece piece={{ kind, color, promoted: false }} />
              </span>
              <span className="hand-piece-count">x{count}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
