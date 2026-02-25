import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyMove } from "../../core/src/applyMove";
import { findKingPosition, isInCheck } from "../../core/src/check";
import { createInitialGameState } from "../../core/src/initialPosition";
import { canChoosePromotion, shouldAutoPromote } from "../../core/src/promotion";
import { type BoardMove, type Color, type GameState, type Move, type PieceKind, type Position } from "../../core/src/types";
import { PIECE_SOUND_PATH } from "./assets";
import { formatMoveText, sideLabel, winnerLabel } from "./game/moveText";
import { positionToKey } from "./game/position";
import { createClockState, DEFAULT_TIME_CONTROL, formatClockText, normalizeTimeControl, type ClockState, type TimeControl } from "./game/timeControl";
import { canOperateTurn, getTurnLockMessage } from "./game/turnControl";
import {
  ApiClientError,
  createGame,
  getGameSnapshot,
  getSessionPlayer,
  joinGame,
  resignGame,
  submitMove,
  type GameSnapshot,
} from "./online/gameApi";
import { buildResultText, toClockState } from "./online/gameSnapshot";
import { formatLobbyError, validateCreateGameForm, validateJoinGameForm } from "./online/lobbyValidation";
import { getPollingIntervalMs, shouldApplySnapshot } from "./online/pollingPolicy";
import { clearStoredSession, loadStoredSession, saveStoredSession } from "./online/sessionPersistence";
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

type SessionState = {
  gameId: string;
  seat: Color;
  displayName: string;
  sessionToken: string;
};

export function App() {
  const initialTimeControl = DEFAULT_TIME_CONTROL;
  const initialState = useMemo(() => createInitialGameState(), []);

  const [screenMode, setScreenMode] = useState<ScreenMode>("setup");
  const [createMainMinutes, setCreateMainMinutes] = useState<string>(String(Math.floor(initialTimeControl.mainSeconds / 60)));
  const [createByoSeconds, setCreateByoSeconds] = useState<string>(String(initialTimeControl.byoSeconds));
  const [joinGameId, setJoinGameId] = useState<string>("");
  const [joinToken, setJoinToken] = useState<string>("");
  const [joinName, setJoinName] = useState<string>("");
  const [joinSeat, setJoinSeat] = useState<Color>("black");
  const [createErrors, setCreateErrors] = useState<string[]>([]);
  const [joinErrors, setJoinErrors] = useState<string[]>([]);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [timeControl, setTimeControl] = useState<TimeControl>(initialTimeControl);

  const [state, setState] = useState<GameState>(initialState);
  const [clockState, setClockState] = useState<ClockState>(() => createClockState(initialTimeControl));
  const [gameVersion, setGameVersion] = useState<number>(1);
  const [selected, setSelected] = useState<Position | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<PieceKind | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [gameMessage, setGameMessage] = useState<string | null>(null);
  const [isSyncingSnapshot, setIsSyncingSnapshot] = useState(false);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [isSubmittingResign, setIsSubmittingResign] = useState(false);
  const pieceSoundRef = useRef<HTMLAudioElement | null>(null);
  const latestVersionRef = useRef(gameVersion);
  const pollingInFlightRef = useRef(false);

  useEffect(() => {
    pieceSoundRef.current = new Audio(PIECE_SOUND_PATH);
    pieceSoundRef.current.preload = "auto";
    return () => {
      if (pieceSoundRef.current) {
        pieceSoundRef.current.pause();
      }
      pieceSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    latestVersionRef.current = gameVersion;
  }, [gameVersion]);

  const clearSelections = useCallback(() => {
    setSelected(null);
    setSelectedDrop(null);
    setPendingPromotion(null);
  }, []);

  const applySnapshot = useCallback(
    (snapshot: GameSnapshot, options: { showDialog?: boolean } = {}) => {
      setState(snapshot.state);
      setClockState(toClockState(snapshot));
      setGameVersion(snapshot.version);
      latestVersionRef.current = snapshot.version;
      setWinner(snapshot.winner);

      const nextResultText = buildResultText(snapshot);
      const finished = snapshot.status === "finished";
      setResultText(nextResultText);
      setGameOver(finished);
      setShowRestartDialog(finished && options.showDialog !== false);
      clearSelections();
    },
    [clearSelections],
  );

  const canOperateNow = canOperateTurn({
    screenMode,
    sessionSeat: session?.seat ?? null,
    turn: state.turn,
    gameOver,
    isPaused,
    pendingPromotion: pendingPromotion !== null,
    isSubmittingMove,
    isSyncingSnapshot,
  });

  const toggleDropSelection = useCallback(
    (kind: PieceKind) => {
      if (!canOperateNow) {
        return;
      }
      setSelected(null);
      setSelectedDrop((current) => (current === kind ? null : kind));
    },
    [canOperateNow],
  );

  const toGameErrorMessage = useCallback((error: unknown): string => {
    if (!(error instanceof ApiClientError)) {
      return "対局操作に失敗しました。時間をおいて再試行してください。";
    }

    const byCode: Record<string, string> = {
      VERSION_CONFLICT: "他プレイヤーの着手が先に反映されました。局面を再取得します。",
      GAME_NOT_ACTIVE: "対局が開始していないため着手できません。",
      NOT_YOUR_TURN: "現在はあなたの手番ではありません。",
      GAME_ALREADY_FINISHED: "対局はすでに終了しています。",
      ILLEGAL_MOVE: "不正な着手です。入力内容を確認してください。",
      UNAUTHORIZED: "セッションが無効です。対局への参加をやり直してください。",
    };

    if (error.code in byCode) {
      return byCode[error.code];
    }
    return formatLobbyError(error);
  }, []);

  const syncSnapshot = useCallback(
    async (
      gameId: string,
      options: {
        showDialog?: boolean;
        suppressError?: boolean;
        onlyIfVersionAdvanced?: boolean;
        background?: boolean;
      } = {},
    ): Promise<boolean> => {
      const { showDialog, suppressError = false, onlyIfVersionAdvanced = false, background = false } = options;
      if (!background) {
        setIsSyncingSnapshot(true);
      }
      try {
        const snapshot = await getGameSnapshot(gameId);
        if (onlyIfVersionAdvanced && !shouldApplySnapshot(latestVersionRef.current, snapshot.version)) {
          return false;
        }
        applySnapshot(snapshot, { showDialog });
        return true;
      } catch (error) {
        if (!suppressError) {
          setGameMessage(toGameErrorMessage(error));
        }
        return false;
      } finally {
        if (!background) {
          setIsSyncingSnapshot(false);
        }
      }
    },
    [applySnapshot, toGameErrorMessage],
  );

  useEffect(() => {
    let disposed = false;

    const restoreSession = async () => {
      const stored = loadStoredSession();
      if (!stored) {
        return;
      }

      setIsRestoringSession(true);
      setJoinGameId(stored.gameId);
      setJoinName(stored.displayName);
      setJoinSeat(stored.seat);
      setJoinMessage("前回対局を復元中です...");

      try {
        const player = await getSessionPlayer({
          gameId: stored.gameId,
          sessionToken: stored.sessionToken,
        });
        const restoredSession: SessionState = {
          gameId: stored.gameId,
          seat: player.seat,
          displayName: player.displayName,
          sessionToken: stored.sessionToken,
        };

        if (disposed) {
          return;
        }

        setSession(restoredSession);
        const restored = await syncSnapshot(restoredSession.gameId, {
          showDialog: false,
          suppressError: true,
        });

        if (disposed) {
          return;
        }

        if (!restored) {
          throw new Error("RESTORE_FAILED");
        }

        saveStoredSession(restoredSession);
        setJoinMessage(null);
        setGameMessage(null);
        setScreenMode("game");
      } catch (error) {
        if (disposed) {
          return;
        }

        clearStoredSession();
        setSession(null);
        setScreenMode("setup");

        if (error instanceof ApiClientError && (error.code === "UNAUTHORIZED" || error.code === "GAME_NOT_FOUND")) {
          setJoinMessage("保存されたセッションは無効です。再参加してください。");
        } else {
          setJoinMessage("前回対局の復元に失敗しました。再参加してください。");
        }
      } finally {
        if (!disposed) {
          setIsRestoringSession(false);
        }
      }
    };

    void restoreSession();

    return () => {
      disposed = true;
    };
  }, [syncSnapshot]);

  const onCreateGame = useCallback(async () => {
    const validated = validateCreateGameForm({ mainMinutes: createMainMinutes, byoSeconds: createByoSeconds });
    if (!validated.ok) {
      setCreateErrors(validated.errors);
      setCreateMessage(null);
      return;
    }

    setCreateErrors([]);
    setCreateMessage(null);
    setIsCreating(true);
    try {
      const created = await createGame(validated.value);
      setJoinGameId(created.gameId);
      setJoinToken(created.joinToken);
      setCreateMessage(`対局を作成しました。gameId: ${created.gameId}`);
      setTimeControl(normalizeTimeControl(validated.value.mainMinutes, validated.value.byoSeconds));
    } catch (error) {
      if (error instanceof ApiClientError) {
        setCreateMessage(formatLobbyError(error));
      } else {
        setCreateMessage("対局作成に失敗しました。時間をおいて再試行してください。");
      }
    } finally {
      setIsCreating(false);
    }
  }, [createMainMinutes, createByoSeconds]);

  const onJoinGame = useCallback(async () => {
    const validated = validateJoinGameForm({
      gameId: joinGameId,
      joinToken,
      name: joinName,
      seat: joinSeat,
    });
    if (!validated.ok) {
      setJoinErrors(validated.errors);
      setJoinMessage(null);
      return;
    }

    setJoinErrors([]);
    setJoinMessage(null);
    setIsJoining(true);
    try {
      const joined = await joinGame(validated.value);
      const nextSession: SessionState = {
        gameId: validated.value.gameId,
        seat: joined.seat,
        displayName: validated.value.name,
        sessionToken: joined.sessionToken,
      };
      setSession(nextSession);
      saveStoredSession(nextSession);
      await syncSnapshot(nextSession.gameId, { showDialog: false });
      setGameMessage(null);
      setScreenMode("game");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setJoinMessage(formatLobbyError(error));
      } else {
        setJoinMessage("対局参加に失敗しました。時間をおいて再試行してください。");
      }
    } finally {
      setIsJoining(false);
    }
  }, [joinGameId, joinToken, joinName, joinSeat, syncSnapshot]);

  useEffect(() => {
    if (screenMode !== "game" || !session || gameOver) {
      return;
    }

    let disposed = false;
    let timerId: number | null = null;

    const scheduleNext = () => {
      if (disposed) {
        return;
      }
      const intervalMs = getPollingIntervalMs(document.hidden);
      timerId = window.setTimeout(() => {
        void pollOnce();
      }, intervalMs);
    };

    const pollOnce = async () => {
      if (disposed) {
        return;
      }
      if (pollingInFlightRef.current) {
        scheduleNext();
        return;
      }

      pollingInFlightRef.current = true;
      try {
        await syncSnapshot(session.gameId, {
          showDialog: false,
          suppressError: true,
          onlyIfVersionAdvanced: true,
          background: true,
        });
      } finally {
        pollingInFlightRef.current = false;
        scheduleNext();
      }
    };

    scheduleNext();

    return () => {
      disposed = true;
      pollingInFlightRef.current = false;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [screenMode, session, gameOver, syncSnapshot]);

  const checkedKing = useMemo(() => {
    if (!isInCheck(state)) {
      return null;
    }
    return findKingPosition(state, state.turn);
  }, [state]);

  const legalTargets = useMemo(() => {
    if (!canOperateNow || !selected || selectedDrop) {
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
  }, [canOperateNow, selected, selectedDrop, state]);

  const legalTargetKeys = useMemo(() => {
    return new Set(legalTargets.map(positionToKey));
  }, [legalTargets]);

  const appendMoveHistory = useCallback(
    (move: Move) => {
      const previousTo = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1].to : null;
      const text = formatMoveText(state, move, previousTo);
      const moveNumber = moveHistory.length + 1;
      setMoveHistory((prev) => [...prev, { id: moveNumber, text, to: move.to }]);
    },
    [moveHistory, state],
  );

  const submitMoveByApi = useCallback(
    async (move: Move) => {
      if (!session || !canOperateNow) {
        return;
      }

      setIsSubmittingMove(true);
      setGameMessage(null);
      try {
        const updated = await submitMove({
          gameId: session.gameId,
          sessionToken: session.sessionToken,
          expectedVersion: gameVersion,
          move,
        });

        appendMoveHistory(move);
        if (pieceSoundRef.current) {
          pieceSoundRef.current.currentTime = 0;
          void pieceSoundRef.current.play().catch(() => {});
        }
        applySnapshot(updated, { showDialog: true });
      } catch (error) {
        if (error instanceof ApiClientError && error.code === "VERSION_CONFLICT") {
          await syncSnapshot(session.gameId, { showDialog: false });
        }
        setGameMessage(toGameErrorMessage(error));
      } finally {
        setIsSubmittingMove(false);
      }
    },
    [session, canOperateNow, gameVersion, appendMoveHistory, applySnapshot, syncSnapshot, toGameErrorMessage],
  );

  const onSquareClick = useCallback(
    (position: Position) => {
      if (!canOperateNow) {
        return;
      }

      if (selectedDrop) {
        void submitMoveByApi({ drop: selectedDrop, to: position });
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

      void submitMoveByApi(move);
      setSelected(null);
    },
    [
      canOperateNow,
      selectedDrop,
      clearSelections,
      state,
      selected,
      submitMoveByApi,
    ],
  );

  const onPromotionChoice = useCallback(
    (promote: boolean) => {
      if (!pendingPromotion) {
        return;
      }

      void submitMoveByApi({ ...pendingPromotion.move, promote });
      clearSelections();
    },
    [pendingPromotion, submitMoveByApi, clearSelections],
  );

  const returnToSetup = useCallback(() => {
    setScreenMode("setup");
    setShowRestartDialog(false);
    setIsPaused(false);
    setGameMessage(null);
    clearStoredSession();
    setSession(null);
    setMoveHistory([]);
    clearSelections();
  }, [clearSelections]);

  const resign = useCallback(async () => {
    if (screenMode !== "game" || gameOver || isPaused || !session || isSubmittingResign || isSyncingSnapshot) {
      return;
    }

    setIsSubmittingResign(true);
    setGameMessage(null);
    try {
      const updated = await resignGame({
        gameId: session.gameId,
        sessionToken: session.sessionToken,
      });

      const moveNumber = moveHistory.length + 1;
      setMoveHistory((prev) => [...prev, { id: moveNumber, text: `${sideLabel(state.turn)}投了`, to: null }]);
      applySnapshot(updated, { showDialog: true });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "GAME_ALREADY_FINISHED") {
        await syncSnapshot(session.gameId, { showDialog: false });
      }
      setGameMessage(toGameErrorMessage(error));
    } finally {
      setIsSubmittingResign(false);
    }
  }, [screenMode, gameOver, isPaused, session, isSubmittingResign, isSyncingSnapshot, moveHistory.length, state.turn, applySnapshot, syncSnapshot, toGameErrorMessage]);

  if (screenMode === "setup") {
    return (
      <SetupScreen
        createMainMinutes={createMainMinutes}
        createByoSeconds={createByoSeconds}
        joinGameId={joinGameId}
        joinToken={joinToken}
        joinName={joinName}
        joinSeat={joinSeat}
        createErrors={createErrors}
        joinErrors={joinErrors}
        createMessage={createMessage}
        joinMessage={joinMessage}
        isCreating={isCreating}
        isJoining={isJoining || isRestoringSession}
        onCreateMainMinutesChange={setCreateMainMinutes}
        onCreateByoSecondsChange={setCreateByoSeconds}
        onJoinGameIdChange={setJoinGameId}
        onJoinTokenChange={setJoinToken}
        onJoinNameChange={setJoinName}
        onJoinSeatChange={setJoinSeat}
        onCreateSubmit={onCreateGame}
        onJoinSubmit={onJoinGame}
      />
    );
  }

  const turnLockMessage = getTurnLockMessage({
    screenMode,
    sessionSeat: session?.seat ?? null,
    turn: state.turn,
    gameOver,
    isPaused,
  });

  const captionText = gameMessage
    ? gameMessage
    : gameOver
      ? `結果: ${resultText ?? "終局"}`
      : isPaused
        ? "一時停止中"
        : `手番: ${winnerLabel(state.turn)}`;

  return (
    <main className="app">
      <h1>Shogi Game</h1>
      {session ? (
        <p className="session-summary">
          gameId: {session.gameId} / seat: {session.seat} / name: {session.displayName} / version: {gameVersion}
        </p>
      ) : null}
      <section className="game-actions" aria-label="game actions">
        <button
          type="button"
          className="setup-button"
          onClick={() => setIsPaused((current) => !current)}
          disabled={gameOver || isSubmittingMove || isSyncingSnapshot || isSubmittingResign}
        >
          {isPaused ? "再開" : "一時停止"}
        </button>
        <button
          type="button"
          className="setup-button"
          onClick={() => {
            if (session) {
              void syncSnapshot(session.gameId, { showDialog: false });
            }
          }}
          disabled={!session || isSyncingSnapshot}
        >
          再取得
        </button>
        <button type="button" className="setup-button" onClick={returnToSetup}>
          設定画面へ戻る
        </button>
      </section>
      {turnLockMessage && !gameMessage ? <p className="turn-lock-message">{turnLockMessage}</p> : null}
      <section className="game-area">
        <div className="hand-anchor hand-anchor-white">
          <Hand
            hands={state.hands}
            color="white"
            active={canOperateNow && session?.seat === "white"}
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
          interactive={canOperateNow}
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
            active={canOperateNow && session?.seat === "black"}
            selectedDrop={selectedDrop}
            onSelectDrop={toggleDropSelection}
          />
        </div>
      </section>
      <p className="caption">{captionText}</p>
      <div className="actions">
        <button
          type="button"
          className="resign-button"
          disabled={gameOver || isPaused || isSubmittingResign || isSubmittingMove || isSyncingSnapshot}
          onClick={() => {
            void resign();
          }}
        >
          {isSubmittingResign ? "投了中..." : "投了"}
        </button>
        {gameOver && !showRestartDialog && session ? (
          <button
            type="button"
            className="restart-button"
            onClick={() => {
              void syncSnapshot(session.gameId, { showDialog: false });
            }}
          >
            局面再取得
          </button>
        ) : null}
      </div>

      <PromotionDialog isOpen={pendingPromotion !== null} onChoose={onPromotionChoice} />
      <GameOverDialog
        isOpen={showRestartDialog && gameOver}
        resultText={resultText}
        onRestart={returnToSetup}
        onClose={() => setShowRestartDialog(false)}
      />
    </main>
  );
}
