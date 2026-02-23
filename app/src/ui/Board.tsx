import { type BoardState, type Position } from "../../../core/src/types";
import { positionToKey } from "../game/position";
import { Piece } from "./Piece";

type BoardProps = {
  board: BoardState;
  selected: Position | null;
  legalTargetKeys: ReadonlySet<string>;
  checkedKing: Position | null;
  onSquareClick: (position: Position) => void;
};

export function Board({ board, selected, legalTargetKeys, checkedKing, onSquareClick }: BoardProps) {
  return (
    <section className="board" aria-label="Shogi board">
      {board.map((row, y) =>
        row.map((cell, x) => {
          const square = { x, y };
          const isSelected = selected?.x === x && selected?.y === y;
          const isLegalTarget = legalTargetKeys.has(positionToKey(square));
          const isCheckedKing = checkedKing?.x === x && checkedKing?.y === y;

          return (
            <button
              key={`${x}-${y}`}
              className={`square ${isSelected ? "is-selected" : ""} ${isLegalTarget ? "is-legal-target" : ""} ${isCheckedKing ? "is-checked-king" : ""}`.trim()}
              onClick={() => onSquareClick(square)}
            >
              {cell ? <Piece piece={cell} /> : null}
            </button>
          );
        }),
      )}
    </section>
  );
}
