import { type BoardState, type Position } from "../../../core/src/types";
import { Piece } from "./Piece";

type BoardProps = {
  board: BoardState;
  selected: Position | null;
  onSquareClick: (position: Position) => void;
};

export function Board({ board, selected, onSquareClick }: BoardProps) {
  return (
    <section className="board" aria-label="Shogi board">
      {board.map((row, y) =>
        row.map((cell, x) => {
          const isSelected = selected?.x === x && selected?.y === y;
          return (
            <button
              key={`${x}-${y}`}
              className={`square ${isSelected ? "is-selected" : ""}`.trim()}
              onClick={() => onSquareClick({ x, y })}
            >
              {cell ? <Piece piece={cell} /> : null}
            </button>
          );
        }),
      )}
    </section>
  );
}
