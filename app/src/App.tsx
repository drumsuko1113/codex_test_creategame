import { useMemo, useState } from "react";
import { applyMove } from "../../core/src/applyMove";
import { createInitialGameState } from "../../core/src/initialPosition";
import { type Position } from "../../core/src/types";
import { Board } from "./ui/Board";

export function App() {
  const initialState = useMemo(() => createInitialGameState(), []);
  const [state, setState] = useState(initialState);
  const [selected, setSelected] = useState<Position | null>(null);

  const onSquareClick = (position: Position) => {
    if (!selected) {
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
      <Board board={state.board} selected={selected} onSquareClick={onSquareClick} />
      <p className="caption">Turn: {state.turn}</p>
    </main>
  );
}
