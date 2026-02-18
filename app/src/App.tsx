import { useMemo, useState } from "react";
import { applyMove } from "../../core/src/applyMove";
import { findKingPosition, isInCheck } from "../../core/src/check";
import { isCheckmate } from "../../core/src/checkmate";
import { createInitialGameState } from "../../core/src/initialPosition";
import { canChoosePromotion, shouldAutoPromote } from "../../core/src/promotion";
import { findSamePositionIndices } from "../../core/src/repetition";
import { type BoardMove, type Color, type GameState, type Piece, type PieceKind, type Position } from "../../core/src/types";
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
  to: Position | null;
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

const PROMOTED_PIECE_LABEL: Partial<Record<PieceKind, string>> = {
  rook: "龍",
  bishop: "馬",
  silver: "全",
  knight: "圭",
  lance: "杏",
  pawn: "と",
};

const FILE_LABEL = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
const RANK_LABEL = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

function oppositeColor(color: Color): Color {
  return color === "black" ? "white" : "black";
}

function sideLabel(color: Color): string {
  return color === "black" ? "▲" : "△";
}

function positionToKifu(position: Position): string {
  return `${FILE_LABEL[position.x]}${RANK_LABEL[position.y]}`;
}

function positionToSource(position: Position): string {
  const file = 9 - position.x;
  const rank = position.y + 1;
  return `(${file}${rank})`;
}

function pieceLabel(piece: Piece): string {
  if (piece.promoted && PROMOTED_PIECE_LABEL[piece.kind]) {
    return PROMOTED_PIECE_LABEL[piece.kind] as string;
  }
  return PIECE_LABEL[piece.kind];
}

function sameSquare(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function formatMoveText(
  stateBefore: GameState,
  move: BoardMove | { drop: PieceKind; to: Position },
  previousTo: Position | null,
): string {
  const mover = sideLabel(stateBefore.turn);
  const destination = previousTo && sameSquare(previousTo, move.to) ? "同" : positionToKifu(move.to);

  if ("drop" in move) {
    return `${mover}${destination}${PIECE_LABEL[move.drop]}打`;
  }

  const piece = stateBefore.board[move.from.y][move.from.x];
  if (!piece) {
    return `${mover}${destination}駒`;
  }

  const label = pieceLabel(piece);
  const baseMove: BoardMove = { from: move.from, to: move.to };
  const promotionAvailable = canChoosePromotion(piece, baseMove);
  const forcedPromotion = shouldAutoPromote(piece, baseMove);

  let promotionSuffix = "";
  if (!piece.promoted) {
    if (move.promote || forcedPromotion) {
      promotionSuffix = "成";
    } else if (promotionAvailable) {
      promotionSuffix = "不成";
    }
  }

  return `${mover}${destination}${label}${promotionSuffix}${positionToSource(move.from)}`;
}

function winnerLabel(color: Color): string {
  return color === "black" ? "先手" : "後手";
}

function findPerpetualCheckLoser(
  stateHistory: GameState[],
  checkingHistory: Array<Color | null>,
  startStateIndex: number,
  endStateIndex: number,
): Color | null {
  const isContinuousBy = (color: Color): boolean => {
    let sawOwnMove = false;

    for (let moveIndex = startStateIndex; moveIndex < endStateIndex; moveIndex += 1) {
      const mover = stateHistory[moveIndex].turn;
      if (mover !== color) {
        continue;
      }

      sawOwnMove = true;
      if (checkingHistory[moveIndex] !== color) {
        return false;
      }
    }

    return sawOwnMove;
  };

  const blackContinuous = isContinuousBy("black");
  const whiteContinuous = isContinuousBy("white");

  if (blackContinuous && !whiteContinuous) {
    return "black";
  }

  if (whiteContinuous && !blackContinuous) {
    return "white";
  }

  return null;
}

export function App() {
  const initialState = useMemo(() => createInitialGameState(), []);
  const [state, setState] = useState(initialState);
  const [stateHistory, setStateHistory] = useState<GameState[]>([initialState]);
  const [checkingHistory, setCheckingHistory] = useState<Array<Color | null>>([]);
  const [selected, setSelected] = useState<Position | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<PieceKind | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);

  const checkedKing = useMemo(() => {
    if (!isInCheck(state)) {
      return null;
    }
    return findKingPosition(state, state.turn);
  }, [state]);

  const legalTargets = useMemo(() => {
    if (!selected || gameOver || pendingPromotion || selectedDrop) {
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
  }, [selected, gameOver, pendingPromotion, selectedDrop, state]);

  const applyAndJudge = (move: BoardMove | { drop: PieceKind; to: Position }) => {
    const result = applyMove(state, move);
    if (!result.ok) {
      return;
    }

    const moveNumber = moveHistory.length + 1;
    const previousTo = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1].to : null;
    const text = formatMoveText(state, move, previousTo);
    setMoveHistory((prev) => [...prev, { id: moveNumber, text, to: move.to }]);
    setState(result.value);

    const checkingColor = isInCheck(result.value) ? state.turn : null;
    const nextStateHistory = [...stateHistory, result.value];
    const nextCheckingHistory = [...checkingHistory, checkingColor];
    setStateHistory(nextStateHistory);
    setCheckingHistory(nextCheckingHistory);

    if (isCheckmate(result.value)) {
      const nextWinner = oppositeColor(result.value.turn);
      setWinner(nextWinner);
      setResultText(`${winnerLabel(nextWinner)}の勝ちです`);
      setGameOver(true);
      setShowRestartDialog(true);
      return;
    }

    const samePositionIndices = findSamePositionIndices(nextStateHistory, result.value);
    if (samePositionIndices.length >= 4) {
      const repetitionStartIndex = samePositionIndices[samePositionIndices.length - 4];
      const repetitionEndIndex = nextStateHistory.length - 1;
      const foulLoser = findPerpetualCheckLoser(
        nextStateHistory,
        nextCheckingHistory,
        repetitionStartIndex,
        repetitionEndIndex,
      );

      if (foulLoser) {
        const nextWinner = oppositeColor(foulLoser);
        setWinner(nextWinner);
        setResultText(`連続王手の千日手により${winnerLabel(nextWinner)}の勝ちです`);
      } else {
        setWinner(null);
        setResultText("千日手（引き分け）です");
      }

      setGameOver(true);
      setShowRestartDialog(true);
    }
  };

  const onSquareClick = (position: Position) => {
    if (gameOver || pendingPromotion) {
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
    const nextInitial = createInitialGameState();
    setState(nextInitial);
    setStateHistory([nextInitial]);
    setCheckingHistory([]);
    setSelected(null);
    setSelectedDrop(null);
    setPendingPromotion(null);
    setWinner(null);
    setResultText(null);
    setGameOver(false);
    setShowRestartDialog(false);
    setMoveHistory([]);
  };

  const resign = () => {
    if (gameOver) {
      return;
    }

    const loser = state.turn;
    const nextWinner = oppositeColor(loser);
    const moveNumber = moveHistory.length + 1;
    setMoveHistory((prev) => [...prev, { id: moveNumber, text: `${sideLabel(loser)}投了`, to: null }]);
    setWinner(nextWinner);
    setResultText(`${winnerLabel(nextWinner)}の勝ちです`);
    setGameOver(true);
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
            active={!gameOver && state.turn === "white"}
            selectedDrop={selectedDrop}
            onSelectDrop={(kind) => {
              if (gameOver || pendingPromotion) {
                return;
              }
              setSelected(null);
              setSelectedDrop((current) => (current === kind ? null : kind));
            }}
          />
          <section className="history-panel" aria-label="move history">
            <h2>棋譜</h2>
            <ol className="history-list">
              {moveHistory.map((record) => (
                <li key={record.id}>{record.text}</li>
              ))}
            </ol>
          </section>
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
            active={!gameOver && state.turn === "black"}
            selectedDrop={selectedDrop}
            onSelectDrop={(kind) => {
              if (gameOver || pendingPromotion) {
                return;
              }
              setSelected(null);
              setSelectedDrop((current) => (current === kind ? null : kind));
            }}
          />
        </div>
      </section>
      <p className="caption">{gameOver ? `終局: ${resultText}` : `手番: ${winnerLabel(state.turn)}`}</p>
      <div className="actions">
        <button type="button" className="resign-button" disabled={gameOver} onClick={resign}>
          投了
        </button>
        {gameOver && !showRestartDialog ? (
          <button type="button" className="restart-button" onClick={startNewGame}>
            再対局
          </button>
        ) : null}
      </div>

      <PromotionDialog isOpen={pendingPromotion !== null} onChoose={onPromotionChoice} />
      <GameOverDialog
        isOpen={showRestartDialog && gameOver}
        resultText={resultText}
        onRestart={startNewGame}
        onClose={() => setShowRestartDialog(false)}
      />
    </main>
  );
}
