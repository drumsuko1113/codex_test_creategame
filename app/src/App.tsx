import { useMemo, useState } from "react";
import { applyMove } from "../../core/src/applyMove";
import { isCheckmate } from "../../core/src/checkmate";
import { createInitialGameState } from "../../core/src/initialPosition";
import { canChoosePromotion, shouldAutoPromote } from "../../core/src/promotion";
import { judgeRepetition } from "../../core/src/repetition";
import { type BoardMove, type Color, type GameState, type PieceKind, type Position } from "../../core/src/types";
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

function colorLabel(color: Color): string {
  return color === "black" ? "先手" : "後手";
}

export function App() {
  const initialState = useMemo(() => createInitialGameState(), []);
  const [state, setState] = useState(initialState);
  const [history, setHistory] = useState<GameState[]>([initialState]);
  const [selected, setSelected] = useState<Position | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<PieceKind | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [showRestartDialog, setShowRestartDialog] = useState(false);

  const finishGame = (message: string, nextWinner: Color | null) => {
    setWinner(nextWinner);
    setResultMessage(message);
    setShowRestartDialog(true);
  };

  const applyAndJudge = (move: BoardMove | { drop: PieceKind; to: Position }) => {
    const result = applyMove(state, move);
    if (!result.ok) {
      return;
    }

    setState(result.value);
    const nextHistory = [...history, result.value];
    setHistory(nextHistory);

    if (isCheckmate(result.value)) {
      const nextWinner = oppositeColor(result.value.turn);
      finishGame(`${colorLabel(nextWinner)}の勝ちです`, nextWinner);
      return;
    }

    const repetition = judgeRepetition(nextHistory);
    if (repetition.kind === "draw") {
      finishGame("千日手により引き分けです", null);
      return;
    }

    if (repetition.kind === "perpetual-check-loss") {
      const nextWinner = oppositeColor(repetition.loser);
      finishGame(`連続王手の千日手により${colorLabel(repetition.loser)}の反則負け、${colorLabel(nextWinner)}の勝ちです`, nextWinner);
    }
  };

  const onSquareClick = (position: Position) => {
    if (winner || resultMessage || pendingPromotion) {
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
    const nextState = createInitialGameState();
    setState(nextState);
    setHistory([nextState]);
    setSelected(null);
    setSelectedDrop(null);
    setPendingPromotion(null);
    setWinner(null);
    setResultMessage(null);
    setShowRestartDialog(false);
  };

  const resign = () => {
    if (winner || resultMessage) {
      return;
    }

    const nextWinner = oppositeColor(state.turn);
    finishGame(`${colorLabel(nextWinner)}の勝ちです（${colorLabel(state.turn)}の投了）`, nextWinner);
    setSelected(null);
    setSelectedDrop(null);
    setPendingPromotion(null);
  };

  return (
    <main className="app">
      <h1>Shogi Game</h1>
      <section className="game-area">
        <div className="hand-anchor hand-anchor-white">
          <Hand
            hands={state.hands}
            color="white"
            active={!winner && !resultMessage && state.turn === "white"}
            selectedDrop={selectedDrop}
            onSelectDrop={(kind) => {
              if (winner || resultMessage || pendingPromotion) {
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
            active={!winner && !resultMessage && state.turn === "black"}
            selectedDrop={selectedDrop}
            onSelectDrop={(kind) => {
              if (winner || resultMessage || pendingPromotion) {
                return;
              }
              setSelected(null);
              setSelectedDrop((current) => (current === kind ? null : kind));
            }}
          />
        </div>
      </section>
      <p className="caption">{resultMessage ?? `手番: ${state.turn === "black" ? "先手" : "後手"}`}</p>
      <div className="actions">
        <button type="button" className="resign-button" disabled={winner !== null || resultMessage !== null} onClick={resign}>
          投了
        </button>
        {resultMessage && !showRestartDialog ? (
          <button type="button" className="restart-button" onClick={startNewGame}>
            再対局
          </button>
        ) : null}
      </div>
      <PromotionDialog isOpen={pendingPromotion !== null} onChoose={onPromotionChoice} />
      <GameOverDialog
        isOpen={showRestartDialog && resultMessage !== null}
        title={resultMessage ?? "終局"}
        winner={winner}
        onRestart={startNewGame}
        onClose={() => setShowRestartDialog(false)}
      />
    </main>
  );
}
