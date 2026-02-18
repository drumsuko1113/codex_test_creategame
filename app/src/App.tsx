import { useMemo, useState } from "react";
import { applyMove } from "../../core/src/applyMove";
import { isCheckmate } from "../../core/src/checkmate";
import { createInitialGameState } from "../../core/src/initialPosition";
import { canChoosePromotion, shouldAutoPromote } from "../../core/src/promotion";
import { type BoardMove, type Color, type PieceKind, type Position } from "../../core/src/types";
import { Board } from "./ui/Board";
import { GameOverDialog } from "./ui/GameOverDialog";
import { Hand } from "./ui/Hand";
import { PromotionDialog } from "./ui/PromotionDialog";

type PendingPromotion = {
  move: BoardMove;
};

function oppositeColor(color: Color): Color {
  return color === "black" ? "white" : "black";
}

export function App() {
  const initialState = useMemo(() => createInitialGameState(), []);
  const [state, setState] = useState(initialState);
  const [selected, setSelected] = useState<Position | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<PieceKind | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);
  const [showRestartDialog, setShowRestartDialog] = useState(false);

  const applyAndJudge = (move: BoardMove | { drop: PieceKind; to: Position }) => {
    const result = applyMove(state, move);
    if (!result.ok) {
      return;
    }

    setState(result.value);

    if (isCheckmate(result.value)) {
      setWinner(oppositeColor(result.value.turn));
      setShowRestartDialog(true);
    }
  };

  const onSquareClick = (position: Position) => {
    if (winner || pendingPromotion) {
      return;
    }

    if (selectedDrop) {
      applyAndJudge({ drop: selectedDrop, to: position });
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

    const movingPiece = state.board[selected.y][selected.x];
    if (!movingPiece) {
      setSelected(null);
      return;
    }

    const move: BoardMove = { from: selected, to: position };
    if (canChoosePromotion(movingPiece, move) && !shouldAutoPromote(movingPiece, move)) {
      setPendingPromotion({ move });
      setSelected(null);
      return;
    }

    applyAndJudge(move);
    setSelected(null);
  };

  const onPromotionChoice = (promote: boolean) => {
    if (!pendingPromotion) {
      return;
    }

    applyAndJudge({ ...pendingPromotion.move, promote });

    setPendingPromotion(null);
    setSelected(null);
    setSelectedDrop(null);
  };

  const startNewGame = () => {
    setState(createInitialGameState());
    setSelected(null);
    setSelectedDrop(null);
    setPendingPromotion(null);
    setWinner(null);
    setShowRestartDialog(false);
  };

  return (
    <main className="app">
      <h1>Shogi Game</h1>
      <section className="game-area">
        <div className="hand-anchor hand-anchor-white">
          <Hand
            hands={state.hands}
            color="white"
            active={!winner && state.turn === "white"}
            selectedDrop={selectedDrop}
            onSelectDrop={(kind) => {
              if (winner || pendingPromotion) {
                return;
              }
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
            active={!winner && state.turn === "black"}
            selectedDrop={selectedDrop}
            onSelectDrop={(kind) => {
              if (winner || pendingPromotion) {
                return;
              }
              setSelected(null);
              setSelectedDrop((current) => (current === kind ? null : kind));
            }}
          />
        </div>
      </section>
      <p className="caption">
        {winner ? `終局: ${winner === "black" ? "先手" : "後手"}の勝ちです` : `手番: ${state.turn === "black" ? "先手" : "後手"}`}
      </p>
      <PromotionDialog isOpen={pendingPromotion !== null} onChoose={onPromotionChoice} />
      <GameOverDialog
        isOpen={showRestartDialog && winner !== null}
        winner={winner}
        onRestart={startNewGame}
        onClose={() => setShowRestartDialog(false)}
      />
    </main>
  );
}
