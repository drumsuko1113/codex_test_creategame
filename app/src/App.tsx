import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyMove } from "../../core/src/applyMove";
import { findKingPosition, isInCheck } from "../../core/src/check";
import { isCheckmate } from "../../core/src/checkmate";
import { createInitialGameState } from "../../core/src/initialPosition";
import { canChoosePromotion, shouldAutoPromote } from "../../core/src/promotion";
import { findSamePositionIndices } from "../../core/src/repetition";
import { type BoardMove, type Color, type GameState, type PieceKind, type Position } from "../../core/src/types";
import { formatMoveText, oppositeColor, sideLabel, winnerLabel } from "./game/moveText";
import { positionToKey } from "./game/position";
import { findPerpetualCheckLoser } from "./game/repetitionJudge";
import { createClockState, DEFAULT_TIME_CONTROL, formatClockText, normalizeTimeControl, type ClockState, type TimeControl } from "./game/timeControl";
import { Board } from "./ui/Board";
import { GameOverDialog } from "./ui/GameOverDialog";
import { Hand } from "./ui/Hand";
import { PromotionDialog } from "./ui/PromotionDialog";
import { SetupScreen } from "./ui/SetupScreen";

type PendingPromotion = {
  move: BoardMove;
};

type MoveRecord = {
  id: number;
  text: string;
  to: Position | null;
};

type ScreenMode = "setup" | "game";

export function App() {
  const initialTimeControl = DEFAULT_TIME_CONTROL;
  const initialState = useMemo(() => createInitialGameState(), []);

  const [screenMode, setScreenMode] = useState<ScreenMode>("setup");
  const [setupStartingTurn, setSetupStartingTurn] = useState<Color>("black");
  const [setupMainMinutes, setSetupMainMinutes] = useState<number>(Math.floor(initialTimeControl.mainSeconds / 60));
  const [setupByoSeconds, setSetupByoSeconds] = useState<number>(initialTimeControl.byoSeconds);
  const [startingTurn, setStartingTurn] = useState<Color>("black");
  const [timeControl, setTimeControl] = useState<TimeControl>(initialTimeControl);

  const [state, setState] = useState<GameState>(initialState);
  const [clockState, setClockState] = useState<ClockState>(() => createClockState(initialTimeControl));
  const [stateHistory, setStateHistory] = useState<GameState[]>([initialState]);
  const [checkingHistory, setCheckingHistory] = useState<Array<Color | null>>([]);
  const [selected, setSelected] = useState<Position | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<PieceKind | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const pieceSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    pieceSoundRef.current = new Audio("/piece-sound.mp3");
    pieceSoundRef.current.preload = "auto";
    return () => {
      if (pieceSoundRef.current) {
        pieceSoundRef.current.pause();
      }
      pieceSoundRef.current = null;
    };
  }, []);

  const clearSelections = useCallback(() => {
    setSelected(null);
    setSelectedDrop(null);
    setPendingPromotion(null);
  }, []);

  const finishGame = useCallback(
    (nextWinner: Color | null, message: string) => {
      setWinner(nextWinner);
      setResultText(message);
      setGameOver(true);
      setShowRestartDialog(true);
      clearSelections();
    },
    [clearSelections],
  );

  const toggleDropSelection = useCallback(
    (kind: PieceKind) => {
      if (gameOver || isPaused || pendingPromotion) {
        return;
      }
      setSelected(null);
      setSelectedDrop((current) => (current === kind ? null : kind));
    },
    [gameOver, isPaused, pendingPromotion],
  );

  const onSetupMainMinutesChange = useCallback((value: string) => {
    const parsed = Number.parseInt(value, 10);
    setSetupMainMinutes(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
  }, []);

  const onSetupByoSecondsChange = useCallback((value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      setSetupByoSeconds(0);
      return;
    }
    setSetupByoSeconds(Math.max(0, Math.floor(parsed / 10) * 10));
  }, []);

  useEffect(() => {
    if (screenMode !== "game" || gameOver || isPaused || pendingPromotion) {
      return;
    }

    const timerId = window.setInterval(() => {
      setClockState((current) => {
        const next: ClockState = {
          main: { ...current.main },
          byo: { ...current.byo },
        };
        const active = state.turn;

        if (next.main[active] > 0) {
          next.main[active] -= 1;
        } else if (timeControl.byoSeconds > 0 && next.byo[active] > 0) {
          next.byo[active] -= 1;
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [screenMode, state.turn, gameOver, isPaused, pendingPromotion, timeControl.byoSeconds]);

  useEffect(() => {
    if (screenMode !== "game" || gameOver || isPaused || pendingPromotion) {
      return;
    }

    const active = state.turn;
    const isMainExpired = clockState.main[active] <= 0;
    const isByoExpired = timeControl.byoSeconds === 0 || clockState.byo[active] <= 0;

    if (!isMainExpired || !isByoExpired) {
      return;
    }

    const nextWinner = oppositeColor(active);
    finishGame(nextWinner, `時間切れにより${winnerLabel(nextWinner)}の勝ちです`);
  }, [screenMode, clockState, gameOver, isPaused, pendingPromotion, state.turn, timeControl.byoSeconds, finishGame]);

  const checkedKing = useMemo(() => {
    if (!isInCheck(state)) {
      return null;
    }
    return findKingPosition(state, state.turn);
  }, [state]);

  const legalTargets = useMemo(() => {
    if (screenMode !== "game" || !selected || gameOver || isPaused || pendingPromotion || selectedDrop) {
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
  }, [screenMode, selected, gameOver, isPaused, pendingPromotion, selectedDrop, state]);

  const legalTargetKeys = useMemo(() => {
    return new Set(legalTargets.map(positionToKey));
  }, [legalTargets]);

  const applyAndJudge = (move: BoardMove | { drop: PieceKind; to: Position }) => {
    const result = applyMove(state, move);
    if (!result.ok) {
      return;
    }

    if (pieceSoundRef.current) {
      pieceSoundRef.current.currentTime = 0;
      void pieceSoundRef.current.play().catch(() => {});
    }

    const moveNumber = moveHistory.length + 1;
    const previousTo = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1].to : null;
    const text = formatMoveText(state, move, previousTo);
    setMoveHistory((prev) => [...prev, { id: moveNumber, text, to: move.to }]);
    setState(result.value);
    setClockState((current) => ({
      main: { ...current.main },
      byo: { ...current.byo, [state.turn]: timeControl.byoSeconds },
    }));

    const checkingColor = isInCheck(result.value) ? state.turn : null;
    const nextStateHistory = [...stateHistory, result.value];
    const nextCheckingHistory = [...checkingHistory, checkingColor];
    setStateHistory(nextStateHistory);
    setCheckingHistory(nextCheckingHistory);

    if (isCheckmate(result.value)) {
      const nextWinner = oppositeColor(result.value.turn);
      finishGame(nextWinner, `${winnerLabel(nextWinner)}の勝ちです`);
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
        finishGame(nextWinner, `連続王手の千日手により${winnerLabel(nextWinner)}の勝ちです`);
      } else {
        finishGame(null, "千日手（引き分け）です");
      }
    }
  };

  const onSquareClick = (position: Position) => {
    if (screenMode !== "game" || gameOver || isPaused || pendingPromotion) {
      return;
    }

    if (selectedDrop) {
      applyAndJudge({ drop: selectedDrop, to: position });
      clearSelections();
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
    clearSelections();
  };

  const startNewGame = (nextTurn: Color = startingTurn, nextTimeControl: TimeControl = timeControl) => {
    const baseState = createInitialGameState();
    const nextInitialState: GameState = {
      ...baseState,
      turn: nextTurn,
    };

    setState(nextInitialState);
    setClockState(createClockState(nextTimeControl));
    setStateHistory([nextInitialState]);
    setCheckingHistory([]);
    clearSelections();
    setWinner(null);
    setResultText(null);
    setGameOver(false);
    setIsPaused(false);
    setShowRestartDialog(false);
    setMoveHistory([]);
  };

  const startMatchFromSetup = () => {
    const nextTimeControl = normalizeTimeControl(setupMainMinutes, setupByoSeconds);
    setStartingTurn(setupStartingTurn);
    setTimeControl(nextTimeControl);
    startNewGame(setupStartingTurn, nextTimeControl);
    setScreenMode("game");
  };

  const returnToSetup = () => {
    setScreenMode("setup");
    setShowRestartDialog(false);
    clearSelections();
    setIsPaused(false);
  };

  const resign = () => {
    if (screenMode !== "game" || gameOver || isPaused) {
      return;
    }

    const loser = state.turn;
    const nextWinner = oppositeColor(loser);
    const moveNumber = moveHistory.length + 1;
    setMoveHistory((prev) => [...prev, { id: moveNumber, text: `${sideLabel(loser)}投了`, to: null }]);
    finishGame(nextWinner, `${winnerLabel(nextWinner)}の勝ちです`);
  };

  if (screenMode === "setup") {
    return (
      <SetupScreen
        startingTurn={setupStartingTurn}
        mainMinutes={setupMainMinutes}
        byoSeconds={setupByoSeconds}
        onStartingTurnChange={setSetupStartingTurn}
        onMainMinutesChange={onSetupMainMinutesChange}
        onByoSecondsChange={onSetupByoSecondsChange}
        onStart={startMatchFromSetup}
      />
    );
  }

  return (
    <main className="app">
      <h1>Shogi Game</h1>
      <section className="game-actions" aria-label="game actions">
        <button type="button" className="setup-button" onClick={() => setIsPaused((current) => !current)} disabled={gameOver}>
          {isPaused ? "対局再開" : "対局中断"}
        </button>
        <button type="button" className="setup-button" onClick={returnToSetup}>
          設定画面へ戻る
        </button>
      </section>
      <section className="game-area">
        <div className="hand-anchor hand-anchor-white">
          <Hand
            hands={state.hands}
            color="white"
            active={!gameOver && !isPaused && state.turn === "white"}
            selectedDrop={selectedDrop}
            onSelectDrop={toggleDropSelection}
          />
          <div className="clock-panel">
            <p className="clock-title">持ち時間</p>
            <p className="clock-main">{formatClockText(clockState.main.white, clockState.byo.white)}</p>
          </div>
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
          legalTargetKeys={legalTargetKeys}
          checkedKing={checkedKing}
          onSquareClick={onSquareClick}
        />

        <div className="hand-anchor hand-anchor-black">
          <div className="clock-panel">
            <p className="clock-title">持ち時間</p>
            <p className="clock-main">{formatClockText(clockState.main.black, clockState.byo.black)}</p>
          </div>
          <Hand
            hands={state.hands}
            color="black"
            active={!gameOver && !isPaused && state.turn === "black"}
            selectedDrop={selectedDrop}
            onSelectDrop={toggleDropSelection}
          />
        </div>
      </section>
      <p className="caption">{gameOver ? `終局: ${resultText}` : isPaused ? "対局中断中" : `手番: ${winnerLabel(state.turn)}`}</p>
      <div className="actions">
        <button type="button" className="resign-button" disabled={gameOver || isPaused} onClick={resign}>
          投了
        </button>
        {gameOver && !showRestartDialog ? (
          <button type="button" className="restart-button" onClick={() => startNewGame()}>
            再対局
          </button>
        ) : null}
      </div>

      <PromotionDialog isOpen={pendingPromotion !== null} onChoose={onPromotionChoice} />
      <GameOverDialog
        isOpen={showRestartDialog && gameOver}
        resultText={resultText}
        onRestart={() => startNewGame()}
        onClose={() => setShowRestartDialog(false)}
      />
    </main>
  );
}
