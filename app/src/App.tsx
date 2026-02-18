import { useMemo, useState } from "react";
import { applyMove } from "../../core/src/applyMove";
import { findKingPosition, isInCheck } from "../../core/src/check";
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

type MoveRecord = {
  id: number;
  text: string;
};

const PIECE_LABEL: Record<PieceKind, string> = {
  king: "玉",
  rook: "飛",
  bishop: "角",
  gold: "金",
  silver: "銀",
  knight: "桂",
  lance: "香",
  pawn: "歩",
};

function oppositeColor(color: Color): Color {
  return color === "black" ? "white" : "black";
}

function colorLabel(color: Color): string {
  return color === "black" ? "先手" : "後手";
}

function squareLabel(position: Position): string {
  return `${position.x + 1}${position.y + 1}`;
}

function formatMoveText(stateBefore: ReturnType<typeof createInitialGameState>, move: BoardMove | { drop: PieceKind; to: Position }, moveNumber: number): string {
  const mover = colorLabel(stateBefore.turn);

  if ("drop" in move) {
    return `${moveNumber}. ${mover} ${PIECE_LABEL[move.drop]}打 ${squareLabel(move.to)}`;
  }

  const piece = stateBefore.board[move.from.y][move.from.x];
  const pieceLabel = piece ? PIECE_LABEL[piece.kind] : "駒";
  const promoteLabel = move.promote ? "成" : "";
  return `${moveNumber}. ${mover} ${pieceLabel}${promoteLabel} ${squareLabel(move.from)}→${squareLabel(move.to)}`;
}

export function App() {
  const initialState = useMemo(() => createInitialGameState(), []);
  const [state, setState] = useState(initialState);
  const [selected, setSelected] = useState<Position | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<PieceKind | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);

  const checkedKing = useMemo(() => {
    if (!isInCheck(state)) {
      return null;
    }
    return findKingPosition(state, state.turn);
  }, [state]);

  const legalTargets = useMemo(() => {
    if (!selected || winner || pendingPromotion || selectedDrop) {
      return [];
    }

    const piece = state.board[selected.y][selected.x];
    if (!piece || piece.color !== state.turn) {
      return [];
    }

    const targets: Position[] = [];

    for (let y = 0; y < 9; y += 1) {
      for (let x = 0; x < 9; x += 1) {
        if (x === selected.x && y === selected.y) {
          continue;
        }

        const baseMove: BoardMove = { from: selected, to: { x, y } };
        const normal = applyMove(state, baseMove).ok;
        const promote = applyMove(state, { ...baseMove, promote: true }).ok;

        if (normal || promote) {
          targets.push({ x, y });
        }
      }
    }

    return targets;
  }, [selected, winner, pendingPromotion, selectedDrop, state]);

  const applyAndJudge = (move: BoardMove | { drop: PieceKind; to: Position }) => {
    const result = applyMove(state, move);
    if (!result.ok) {
      return;
    }

    const moveNumber = moveHistory.length + 1;
    setMoveHistory((prev) => [...prev, { id: moveNumber, text: formatMoveText(state, move, moveNumber) }]);
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
    setMoveHistory([]);
  };

  const resign = () => {
    if (winner) {
      return;
    }

    const loser = state.turn;
    const nextWinner = oppositeColor(loser);
    const moveNumber = moveHistory.length + 1;
    setMoveHistory((prev) => [...prev, { id: moveNumber, text: `${moveNumber}. ${colorLabel(loser)} 投了` }]);
    setWinner(nextWinner);
    setShowRestartDialog(true);
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

        <Board
          board={state.board}
          selected={selected}
          legalTargets={legalTargets}
          checkedKing={checkedKing}
          onSquareClick={onSquareClick}
        />

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
      <div className="actions">
        <button type="button" className="resign-button" disabled={winner !== null} onClick={resign}>
          投了
        </button>
        {winner && !showRestartDialog ? (
          <button type="button" className="restart-button" onClick={startNewGame}>
            再対局
          </button>
        ) : null}
      </div>

      <section className="history-panel" aria-label="move history">
        <h2>棋譜</h2>
        <ol className="history-list">
          {moveHistory.map((record) => (
            <li key={record.id}>{record.text}</li>
          ))}
        </ol>
      </section>

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
