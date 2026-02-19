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
  const slots: Array<{ id: string; kind: PieceKind; stackCount: number | null }> = [];

  HAND_ORDER.forEach((kind) => {
    const count = hands[color][kind] ?? 0;
    if (count >= 4) {
      slots.push({ id: `${kind}-stack`, kind, stackCount: count });
      return;
    }
    for (let i = 0; i < count; i += 1) {
      slots.push({ id: `${kind}-${i}`, kind, stackCount: null });
    }
  });

  return (
    <aside className="hand-panel" aria-label={`${PLAYER_LABEL[color]}の持ち駒`}>
      <span className="hand-title">{PLAYER_LABEL[color]}の持ち駒</span>
      <div className="hand-pieces">
        {slots.length === 0 ? <span className="hand-empty">なし</span> : null}
        {slots.map((slot) => {
          const selected = active && selectedDrop === slot.kind;
          return (
            <button
              key={`${color}-${slot.id}`}
              type="button"
              disabled={!active}
              className={`hand-piece ${selected ? "is-selected" : ""}`.trim()}
              onClick={() => onSelectDrop(slot.kind)}
            >
              <span className="hand-piece-icon" aria-hidden="true">
                <Piece piece={{ kind: slot.kind, color, promoted: false }} />
              </span>
              {slot.stackCount ? <span className="hand-piece-stack">x{slot.stackCount}</span> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
