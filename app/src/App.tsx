import { useMemo, useState } from "react";
import { applyMove } from "../../core/src/applyMove";
import { createInitialGameState } from "../../core/src/initialPosition";
import { type PieceKind, type Position } from "../../core/src/types";
import { Board } from "./ui/Board";
import { Hand } from "./ui/Hand";

export function App() {
  const initialState = useMemo(() => createInitialGameState(), []);
  const [state, setState] = useState(initialState);
  const [selected, setSelected] = useState<Position | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<PieceKind | null>(null);

  const onSquareClick = (position: Position) => {
    if (selectedDrop) {
      const result = applyMove(state, { drop: selectedDrop, to: position });
      if (result.ok) {
        setState(result.value);
      }
      setSelectedDrop(null);
      setSelected(null);
      return;
    }

    const clickedPiece = state.board[position.y][position.x];

    if (!selected) {
      if (clickedPiece?.color !== state.turn) {
        return;
      }
      setSelected(position);
      return;
    }

    if (clickedPiece?.color === state.turn) {
      setSelected(position);
      return;
    }

    const result = applyMove(state, { from: selected, to: position });
    if (result.ok) {
      setState(result.value);
    }
    setSelected(null);
  };

  return (
    <main className="app">
      <h1>Shogi Game</h1>
      <section className="game-area">
        <div className="hand-anchor hand-anchor-white">
          <Hand
            hands={state.hands}
            color="white"
            active={state.turn === "white"}
            selectedDrop={selectedDrop}
            onSelectDrop={(kind) => {
              setSelected(null);
              setSelectedDrop((current) => (current === kind ? null : kind));
            }}
          />
        </div>

        <Board board={state.board} selected={selected} onSquareClick={onSquareClick} />

        <div className="hand-anchor hand-anchor-black">
          <Hand
            hands={state.hands}
            color="black"
            active={state.turn === "black"}
            selectedDrop={selectedDrop}
            onSelectDrop={(kind) => {
              setSelected(null);
              setSelectedDrop((current) => (current === kind ? null : kind));
            }}
          />
        </div>
      </section>
      <p className="caption">手番: {state.turn === "black" ? "先手" : "後手"}</p>
    </main>
  );
}
