import { BOARD_SIZE } from "../../../core/src/constants";
import { type BoardState, type Color, type Position } from "../../../core/src/types";
import { positionToKey, toBoardPosition } from "../game/position";
import { Piece } from "./Piece";

type BoardProps = {
  board: BoardState;
  selected: Position | null;
  legalTargetKeys: ReadonlySet<string>;
  checkedKing: Position | null;
  interactive: boolean;
  perspective: Color;
  onSquareClick: (position: Position) => void;
};

export function Board({ board, selected, legalTargetKeys, checkedKing, interactive, perspective, onSquareClick }: BoardProps) {
  const displayIndices = Array.from({ length: BOARD_SIZE }, (_, index) => index);

  return (
    <section className={`board ${interactive ? "" : "is-readonly"}`.trim()} aria-label="Shogi board">
      {displayIndices.map((displayY) =>
        displayIndices.map((displayX) => {
          const square = toBoardPosition({ x: displayX, y: displayY }, perspective);
          const cell = board[square.y][square.x];
          const isSelected = selected?.x === square.x && selected?.y === square.y;
          const isLegalTarget = legalTargetKeys.has(positionToKey(square));
          const isCheckedKing = checkedKing?.x === square.x && checkedKing?.y === square.y;

          return (
            <button
              key={`${displayX}-${displayY}`}
              className={`square ${isSelected ? "is-selected" : ""} ${isLegalTarget ? "is-legal-target" : ""} ${isCheckedKing ? "is-checked-king" : ""}`.trim()}
              disabled={!interactive}
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
