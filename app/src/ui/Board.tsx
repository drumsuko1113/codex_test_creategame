import { type KeyboardEvent } from "react";
import { type BoardState, type Position } from "../../../core/src/types";
import { Piece } from "./Piece";

type BoardProps = {
  board: BoardState;
  selected: Position | null;
  legalTargets: Position[];
  checkedKing: Position | null;
  keyboardCursor: Position | null;
  lastMoveTo: Position | null;
  onSquareClick: (position: Position) => void;
  onBoardKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export function Board({ board, selected, legalTargets, checkedKing, keyboardCursor, lastMoveTo, onSquareClick, onBoardKeyDown }: BoardProps) {
  return (
    <section className="board" aria-label="Shogi board" tabIndex={0} onKeyDown={onBoardKeyDown}>
      {board.map((row, y) =>
        row.map((cell, x) => {
          const isSelected = selected?.x === x && selected?.y === y;
          const isLegalTarget = legalTargets.some((position) => position.x === x && position.y === y);
          const isCheckedKing = checkedKing?.x === x && checkedKing?.y === y;
          const isKeyboardCursor = keyboardCursor?.x === x && keyboardCursor?.y === y;
          const isLastMove = lastMoveTo?.x === x && lastMoveTo?.y === y;

          return (
            <button
              key={`${x}-${y}`}
              className={`square ${isSelected ? "is-selected" : ""} ${isLegalTarget ? "is-legal-target" : ""} ${isCheckedKing ? "is-checked-king" : ""} ${isKeyboardCursor ? "is-keyboard-cursor" : ""} ${isLastMove ? "is-last-move" : ""}`.trim()}
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
