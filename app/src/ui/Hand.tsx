import { type Color, type HandState, type PieceKind } from "../../../core/src/types";

type HandProps = {
  hands: HandState;
  turn: Color;
  selectedDrop: PieceKind | null;
  onSelectDrop: (kind: PieceKind) => void;
};

const HAND_ORDER: PieceKind[] = ["rook", "bishop", "gold", "silver", "knight", "lance", "pawn"];

const HAND_LABELS: Record<PieceKind, string> = {
  king: "K",
  rook: "R",
  bishop: "B",
  gold: "G",
  silver: "S",
  knight: "N",
  lance: "L",
  pawn: "P",
};

function HandRow({
  color,
  hands,
  active,
  selectedDrop,
  onSelectDrop,
}: {
  color: Color;
  hands: HandState;
  active: boolean;
  selectedDrop: PieceKind | null;
  onSelectDrop: (kind: PieceKind) => void;
}) {
  return (
    <div className="hand-row">
      <span className="hand-title">{color}</span>
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
              {HAND_LABELS[kind]} x{count}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Hand({ hands, turn, selectedDrop, onSelectDrop }: HandProps) {
  return (
    <aside className="hands" aria-label="Hands">
      <HandRow color="black" hands={hands} active={turn === "black"} selectedDrop={selectedDrop} onSelectDrop={onSelectDrop} />
      <HandRow color="white" hands={hands} active={turn === "white"} selectedDrop={selectedDrop} onSelectDrop={onSelectDrop} />
    </aside>
  );
}
