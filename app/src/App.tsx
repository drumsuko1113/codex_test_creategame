import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyMove } from "../../core/src/applyMove";
import { findKingPosition, isInCheck } from "../../core/src/check";
import { isCheckmate } from "../../core/src/checkmate";
import { createInitialGameState } from "../../core/src/initialPosition";
import { generateLegalMoves } from "../../core/src/moveGenerator";
import { canChoosePromotion, shouldAutoPromote } from "../../core/src/promotion";
import { type BoardMove, type Color, type GameState, type Move, type PieceKind, type Position } from "../../core/src/types";
import { PIECE_SOUND_PATH } from "./assets";
import { formatMoveText, oppositeColor, sideLabel, winnerLabel } from "./game/moveText";
import { positionToKey } from "./game/position";
import {
  createClockState,
  DEFAULT_TIME_CONTROL,
  formatClockText,
  projectClockState,
  type ClockState,
} from "./game/timeControl";
import { canOperateTurn, getTurnLockMessage } from "./game/turnControl";
import {
  ApiClientError,
  getGameSnapshot,
  getSessionPlayer,
  matchLobby,
  resignGame,
  submitMove,
  type GameSnapshot,
} from "./online/gameApi";
import { buildResultText, toClockState } from "./online/gameSnapshot";
import { formatLobbyError, validateMatchLobbyForm, validateSpectateGameForm } from "./online/lobbyValidation";
import { shouldApplySnapshot } from "./online/pollingPolicy";
import { computePollingRetryDelayMs, isRetryableNetworkError } from "./online/networkRecovery";
import { buildGameEventsWebSocketUrl, parseRealtimeSnapshotMessage } from "./online/realtimeEvents";
import { clearStoredSession, loadStoredSession, saveStoredSession } from "./online/sessionPersistence";
import { buildSpectatorUrl, parseSpectateGameId } from "./online/spectatorLink";
import { chooseRandomMove } from "../../bot/src/randomBot";
import { getBotResignOutcome, isBotTurn } from "./game/botMode";
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
type MatchMode = "online" | "bot";

type SessionState = {
  gameId: string;
  seat: Color;
  displayName: string;
  sessionToken: string;
};

export function App() {
  const initialTimeControl = DEFAULT_TIME_CONTROL;
  const initialState = useMemo(() => createInitialGameState(), []);
  const initialSpectateGameId = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return parseSpectateGameId(window.location.search);
  }, []);

  const [screenMode, setScreenMode] = useState<ScreenMode>("setup");
  const [setupMode, setSetupMode] = useState<MatchMode>("online");
  const [matchMode, setMatchMode] = useState<MatchMode>("online");
  const [passphrase, setPassphrase] = useState<string>("");
  const [spectateGameId, setSpectateGameId] = useState<string>(initialSpectateGameId ?? "");
  const [joinName, setJoinName] = useState<string>("");
  const [botName, setBotName] = useState<string>("player");
  const [botSeat, setBotSeat] = useState<Color>("black");
  const [joinErrors, setJoinErrors] = useState<string[]>([]);
  const [spectateErrors, setSpectateErrors] = useState<string[]>([]);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [spectateMessage, setSpectateMessage] = useState<string | null>(null);
  const [botMessage, setBotMessage] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isStartingSpectate, setIsStartingSpectate] = useState(false);
  const [isStartingBot, setIsStartingBot] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [spectatorGameId, setSpectatorGameId] = useState<string | null>(null);

  const [state, setState] = useState<GameState>(initialState);
  const [clockState, setClockState] = useState<ClockState>(() => createClockState(initialTimeControl));
  const [clockTurnStartedAtMs, setClockTurnStartedAtMs] = useState<number>(() => Date.now());
  const [clockNowMs, setClockNowMs] = useState<number>(() => Date.now());
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
  const [networkBannerMessage, setNetworkBannerMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));
  const [isSyncingSnapshot, setIsSyncingSnapshot] = useState(false);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [isSubmittingResign, setIsSubmittingResign] = useState(false);
  const pieceSoundRef = useRef<HTMLAudioElement | null>(null);
  const latestVersionRef = useRef(gameVersion);
  const hasAutoStartedSpectateRef = useRef(false);

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

  const onSetupModeChange = useCallback((mode: MatchMode) => {
    setSetupMode(mode);
    setJoinErrors([]);
    setSpectateErrors([]);
    setJoinMessage(null);
    setSpectateMessage(null);
    setBotMessage(null);
  }, []);

  const replaceSpectateLocation = useCallback((gameId: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = gameId
      ? buildSpectatorUrl(window.location.origin, window.location.pathname, gameId)
      : `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  const spectatorUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const sourceGameId = spectateGameId.trim();
    if (!sourceGameId) {
      return null;
    }
    return buildSpectatorUrl(window.location.origin, window.location.pathname, sourceGameId);
  }, [spectateGameId]);

  const setNetworkBannerFromError = useCallback((error: unknown) => {
    if (!isRetryableNetworkError(error)) {
      return;
    }

    const message = typeof navigator !== "undefined" && !navigator.onLine
      ? "オフラインです。ネットワーク復帰後に再試行してください。"
      : "通信に失敗しました。再試行してください。";
    setNetworkBannerMessage(message);
  }, []);

  const applySnapshot = useCallback(
    (snapshot: GameSnapshot, options: { showDialog?: boolean } = {}) => {
      setState(snapshot.state);
      setClockState(toClockState(snapshot));
      setClockTurnStartedAtMs(snapshot.turnStartedAtMs);
      setClockNowMs(Date.now());
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

  const playerSeat = matchMode === "bot" ? botSeat : session?.seat ?? null;
  const onlineGameId = session?.gameId ?? spectatorGameId;
  const isSpectatorMode = matchMode === "online" && session === null && screenMode === "game";

  const canOperateNow = canOperateTurn({
    screenMode,
    sessionSeat: playerSeat,
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
          return true;
        }
        applySnapshot(snapshot, { showDialog });
        if (typeof navigator === "undefined" || navigator.onLine) {
          setNetworkBannerMessage(null);
        }
        return true;
      } catch (error) {
        setNetworkBannerFromError(error);
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
    [applySnapshot, toGameErrorMessage, setNetworkBannerFromError],
  );

  useEffect(() => {
    if (initialSpectateGameId) {
      return;
    }

    let disposed = false;

    const restoreSession = async () => {
      const stored = loadStoredSession();
      if (!stored) {
        return;
      }

      setIsRestoringSession(true);
      setJoinName(stored.displayName);
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
        setSpectatorGameId(null);
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
        setSpectateMessage(null);
        setSpectateErrors([]);
        replaceSpectateLocation(null);
        setMatchMode("online");
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
  }, [initialSpectateGameId, replaceSpectateLocation, syncSnapshot]);

  const onJoinGame = useCallback(async () => {
    const validated = validateMatchLobbyForm({
      passphrase,
      name: joinName,
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
      const joined = await matchLobby(validated.value);
      const nextSession: SessionState = {
        gameId: joined.gameId,
        seat: joined.seat,
        displayName: validated.value.name,
        sessionToken: joined.sessionToken,
      };
      setSession(nextSession);
      setSpectatorGameId(null);
      saveStoredSession(nextSession);
      await syncSnapshot(nextSession.gameId, { showDialog: false });
      setGameMessage(null);
      setNetworkBannerMessage(null);
      setSpectateErrors([]);
      setSpectateMessage(null);
      replaceSpectateLocation(null);
      setMatchMode("online");
      setScreenMode("game");
    } catch (error) {
      setNetworkBannerFromError(error);
      if (error instanceof ApiClientError) {
        setJoinMessage(formatLobbyError(error));
      } else {
        setJoinMessage("対局参加に失敗しました。時間をおいて再試行してください。");
      }
    } finally {
      setIsJoining(false);
    }
  }, [passphrase, joinName, replaceSpectateLocation, syncSnapshot, setNetworkBannerFromError]);

  const startSpectatingByGameId = useCallback(async (gameId: string): Promise<boolean> => {
    setIsStartingSpectate(true);
    try {
      clearStoredSession();
      setSession(null);
      setSpectatorGameId(gameId);
      setMatchMode("online");
      setSetupMode("online");
      setScreenMode("game");
      setIsPaused(false);
      setMoveHistory([]);
      setWinner(null);
      setResultText(null);
      setGameOver(false);
      setShowRestartDialog(false);
      setGameMessage(null);
      setNetworkBannerMessage(null);
      setState(initialState);
      setClockState(createClockState(initialTimeControl));
      setClockTurnStartedAtMs(Date.now());
      setClockNowMs(Date.now());
      setGameVersion(1);
      latestVersionRef.current = 1;
      clearSelections();

      const synced = await syncSnapshot(gameId, { showDialog: false });
      if (!synced) {
        setScreenMode("setup");
        setSpectatorGameId(null);
        setGameMessage(null);
        setSpectateMessage("観戦開始に失敗しました。gameIdを確認してください。");
        replaceSpectateLocation(null);
        return false;
      }

      setSpectateGameId(gameId);
      setSpectateMessage(`観戦中: ${gameId}`);
      replaceSpectateLocation(gameId);
      return true;
    } finally {
      setIsStartingSpectate(false);
    }
  }, [clearSelections, initialState, initialTimeControl, replaceSpectateLocation, syncSnapshot]);

  const onStartSpectate = useCallback(async () => {
    const validated = validateSpectateGameForm({ gameId: spectateGameId });
    if (!validated.ok) {
      setSpectateErrors(validated.errors);
      setSpectateMessage(null);
      return;
    }

    setSpectateErrors([]);
    setSpectateMessage(null);
    await startSpectatingByGameId(validated.value.gameId);
  }, [spectateGameId, startSpectatingByGameId]);

  const onStartBotGame = useCallback(() => {
    const normalizedName = botName.trim();
    if (!normalizedName) {
      setBotMessage("\u8868\u793a\u540d\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      return;
    }

    setIsStartingBot(true);
    try {
      setBotName(normalizedName);
      const localSession: SessionState = {
        gameId: "local-bot",
        seat: botSeat,
        displayName: normalizedName,
        sessionToken: "local-bot",
      };

      clearStoredSession();
      setSession(localSession);
      setSpectatorGameId(null);
      setMatchMode("bot");
      setScreenMode("game");
      setState(initialState);
      setClockState(createClockState(initialTimeControl));
      setClockTurnStartedAtMs(Date.now());
      setClockNowMs(Date.now());
      setGameVersion(1);
      latestVersionRef.current = 1;
      setWinner(null);
      setResultText(null);
      setGameOver(false);
      setShowRestartDialog(false);
      setIsPaused(false);
      setMoveHistory([]);
      setGameMessage(null);
      setNetworkBannerMessage(null);
      setBotMessage(null);
      setSpectateMessage(null);
      setSpectateErrors([]);
      replaceSpectateLocation(null);
      clearSelections();
    } finally {
      setIsStartingBot(false);
    }
  }, [botName, botSeat, clearSelections, initialState, initialTimeControl, replaceSpectateLocation]);

  useEffect(() => {
    if (!initialSpectateGameId || hasAutoStartedSpectateRef.current) {
      return;
    }

    hasAutoStartedSpectateRef.current = true;
    setSpectateErrors([]);
    setSpectateMessage(null);
    void startSpectatingByGameId(initialSpectateGameId);
  }, [initialSpectateGameId, startSpectatingByGameId]);

  useEffect(() => {
    if (
      typeof window === "undefined"
      || typeof WebSocket === "undefined"
      || screenMode !== "game"
      || matchMode !== "online"
      || !onlineGameId
      || gameOver
      || isOffline
    ) {
      return;
    }

    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimerId: number | null = null;
    let reconnectFailureCount = 0;

    const clearSocket = () => {
      if (!socket) {
        return;
      }
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      socket = null;
    };

    const clearReconnectTimer = () => {
      if (reconnectTimerId !== null) {
        window.clearTimeout(reconnectTimerId);
        reconnectTimerId = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimerId !== null) {
        return;
      }
      const delayMs = computePollingRetryDelayMs(1000, reconnectFailureCount);
      reconnectFailureCount += 1;
      reconnectTimerId = window.setTimeout(() => {
        reconnectTimerId = null;
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (disposed) {
        return;
      }
      clearSocket();
      clearReconnectTimer();

      try {
        const wsUrl = buildGameEventsWebSocketUrl(onlineGameId);
        socket = new WebSocket(wsUrl);
      } catch {
        setNetworkBannerMessage("リアルタイム接続に失敗しました。再接続を試行します。");
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        reconnectFailureCount = 0;
        setNetworkBannerMessage(null);
        void syncSnapshot(onlineGameId, {
          showDialog: false,
          suppressError: true,
          onlyIfVersionAdvanced: true,
          background: true,
        }).then((synced) => {
          if (synced) {
            setGameMessage(null);
          }
        });
      };

      socket.onmessage = (event) => {
        const snapshot = parseRealtimeSnapshotMessage(event.data);
        if (!snapshot || snapshot.id !== onlineGameId) {
          return;
        }
        if (!shouldApplySnapshot(latestVersionRef.current, snapshot.version)) {
          return;
        }
        applySnapshot(snapshot, { showDialog: false });
        setGameMessage(null);
        setNetworkBannerMessage(null);
      };

      socket.onerror = () => {
        if (disposed) {
          return;
        }
        setNetworkBannerMessage("リアルタイム同期が不安定です。再接続を試行します。");
      };

      socket.onclose = () => {
        if (disposed) {
          return;
        }
        setNetworkBannerMessage("リアルタイム接続が切断されました。再接続しています。");
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      clearSocket();
    };
  }, [screenMode, matchMode, onlineGameId, gameOver, isOffline, syncSnapshot, applySnapshot]);

  useEffect(() => {
    if (matchMode !== "online" || typeof window === "undefined") {
      return;
    }

    const handleOffline = () => {
      setIsOffline(true);
      setNetworkBannerMessage("オフラインです。ネットワーク復帰を待機しています。");
    };

    const handleOnline = () => {
      setIsOffline(false);
      setNetworkBannerMessage("ネットワークに再接続しました。同期を再試行します。");

      if (screenMode === "game" && onlineGameId && !gameOver) {
        void syncSnapshot(onlineGameId, { showDialog: false, suppressError: true }).then((synced) => {
          if (synced) {
            setNetworkBannerMessage(null);
            setGameMessage(null);
          }
        });
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [matchMode, screenMode, onlineGameId, gameOver, syncSnapshot]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (screenMode !== "game" || matchMode !== "online" || gameOver) {
      return;
    }

    const timerId = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, 250);

    return () => {
      window.clearInterval(timerId);
    };
  }, [screenMode, matchMode, gameOver]);

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

  const playPieceSound = useCallback(() => {
    if (!pieceSoundRef.current) {
      return;
    }
    pieceSoundRef.current.currentTime = 0;
    void pieceSoundRef.current.play().catch(() => {});
  }, []);

  const resolveBotMatchOutcome = useCallback((nextState: GameState): boolean => {
    const hasPlayableMove = generateLegalMoves(nextState).some((candidate) => applyMove(nextState, candidate).ok);
    if (hasPlayableMove) {
      return false;
    }

    if (isCheckmate(nextState)) {
      const nextWinner = oppositeColor(nextState.turn);
      setWinner(nextWinner);
      setResultText(`${winnerLabel(nextWinner)}\u306e\u52dd\u3061\uff08\u8a70\u307f\uff09`);
    } else {
      setWinner(null);
      setResultText("\u5f15\u304d\u5206\u3051\uff08\u5408\u6cd5\u624b\u306a\u3057\uff09");
    }

    setGameOver(true);
    setShowRestartDialog(true);
    return true;
  }, []);

  const submitMoveByBot = useCallback(
    (move: Move) => {
      if (screenMode !== "game" || matchMode !== "bot" || !canOperateNow) {
        return;
      }

      const applied = applyMove(state, move);
      if (!applied.ok) {
        setGameMessage("\u4e0d\u6b63\u306a\u7740\u624b\u3067\u3059\u3002\u5165\u529b\u5185\u5bb9\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
        return;
      }

      appendMoveHistory(move);
      playPieceSound();
      setState(applied.value);
      setGameVersion((current) => {
        const next = current + 1;
        latestVersionRef.current = next;
        return next;
      });
      setGameMessage(null);

      const ended = resolveBotMatchOutcome(applied.value);
      if (!ended) {
        setGameOver(false);
        setShowRestartDialog(false);
        setWinner(null);
        setResultText(null);
      }
    },
    [screenMode, matchMode, canOperateNow, state, appendMoveHistory, playPieceSound, resolveBotMatchOutcome],
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
        playPieceSound();
        applySnapshot(updated, { showDialog: true });
        setNetworkBannerMessage(null);
      } catch (error) {
        if (error instanceof ApiClientError && error.code === "VERSION_CONFLICT") {
          await syncSnapshot(session.gameId, { showDialog: false });
        }
        setNetworkBannerFromError(error);
        setGameMessage(toGameErrorMessage(error));
      } finally {
        setIsSubmittingMove(false);
      }
    },
    [session, canOperateNow, gameVersion, appendMoveHistory, playPieceSound, applySnapshot, syncSnapshot, toGameErrorMessage],
  );

  const submitMoveByMode = useCallback(
    (move: Move) => {
      if (matchMode === "online") {
        void submitMoveByApi(move);
        return;
      }
      submitMoveByBot(move);
    },
    [matchMode, submitMoveByApi, submitMoveByBot],
  );

  const onSquareClick = useCallback(
    (position: Position) => {
      if (!canOperateNow) {
        return;
      }

      if (selectedDrop) {
        submitMoveByMode({ drop: selectedDrop, to: position });
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

      submitMoveByMode(move);
      setSelected(null);
    },
    [
      canOperateNow,
      selectedDrop,
      clearSelections,
      state,
      selected,
      submitMoveByMode,
    ],
  );

  const onPromotionChoice = useCallback(
    (promote: boolean) => {
      if (!pendingPromotion) {
        return;
      }

      submitMoveByMode({ ...pendingPromotion.move, promote });
      clearSelections();
    },
    [pendingPromotion, submitMoveByMode, clearSelections],
  );

  useEffect(() => {
    if (
      screenMode !== "game"
      || matchMode !== "bot"
      || gameOver
      || isPaused
      || pendingPromotion !== null
      || isSubmittingMove
      || isSubmittingResign
      || isSyncingSnapshot
      || !isBotTurn(botSeat, state.turn)
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      let selectedMove = chooseRandomMove(state);
      if (selectedMove) {
        const result = applyMove(state, selectedMove);
        if (!result.ok) {
          selectedMove = generateLegalMoves(state).find((candidate) => applyMove(state, candidate).ok) ?? null;
        }
      }

      if (!selectedMove) {
        resolveBotMatchOutcome(state);
        return;
      }

      const applied = applyMove(state, selectedMove);
      if (!applied.ok) {
        setGameMessage("\u30dc\u30c3\u30c8\u306e\u7740\u624b\u751f\u6210\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
        return;
      }

      appendMoveHistory(selectedMove);
      playPieceSound();
      setState(applied.value);
      setGameVersion((current) => {
        const next = current + 1;
        latestVersionRef.current = next;
        return next;
      });
      setGameMessage(null);

      const ended = resolveBotMatchOutcome(applied.value);
      if (!ended) {
        setGameOver(false);
        setShowRestartDialog(false);
        setWinner(null);
        setResultText(null);
      }
    }, 350);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    screenMode,
    matchMode,
    gameOver,
    isPaused,
    pendingPromotion,
    isSubmittingMove,
    isSubmittingResign,
    isSyncingSnapshot,
    botSeat,
    state,
    appendMoveHistory,
    playPieceSound,
    resolveBotMatchOutcome,
  ]);

  const returnToSetup = useCallback(() => {
    setScreenMode("setup");
    setSetupMode("online");
    setMatchMode("online");
    setShowRestartDialog(false);
    setIsPaused(false);
    setGameMessage(null);
    setNetworkBannerMessage(null);
    setBotMessage(null);
    setSpectateMessage(null);
    setSpectateErrors([]);
    setIsStartingSpectate(false);
    setIsStartingBot(false);
    clearStoredSession();
    setSession(null);
    setSpectatorGameId(null);
    setMoveHistory([]);
    setWinner(null);
    setResultText(null);
    setGameOver(false);
    setState(initialState);
    setClockState(createClockState(initialTimeControl));
    setClockTurnStartedAtMs(Date.now());
    setClockNowMs(Date.now());
    setGameVersion(1);
    latestVersionRef.current = 1;
    replaceSpectateLocation(null);
    clearSelections();
  }, [clearSelections, initialState, initialTimeControl, replaceSpectateLocation]);

  const resign = useCallback(async () => {
    if (screenMode !== "game" || gameOver || isPaused || isSubmittingResign || isSyncingSnapshot) {
      return;
    }

    setIsSubmittingResign(true);
    setGameMessage(null);
    try {
      const moveNumber = moveHistory.length + 1;

      if (matchMode === "bot") {
        const outcome = getBotResignOutcome(botSeat);
        setMoveHistory((prev) => [...prev, { id: moveNumber, text: `${sideLabel(botSeat)}投了`, to: null }]);
        setWinner(outcome.winner);
        setResultText(outcome.resultText);
        setGameOver(true);
        setShowRestartDialog(true);
        return;
      }

      if (!session) {
        return;
      }

      const updated = await resignGame({
        gameId: session.gameId,
        sessionToken: session.sessionToken,
      });

      setMoveHistory((prev) => [...prev, { id: moveNumber, text: `${sideLabel(state.turn)}投了`, to: null }]);
      applySnapshot(updated, { showDialog: true });
      setNetworkBannerMessage(null);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "GAME_ALREADY_FINISHED") {
        await syncSnapshot(session.gameId, { showDialog: false });
      }
      setNetworkBannerFromError(error);
      setGameMessage(toGameErrorMessage(error));
    } finally {
      setIsSubmittingResign(false);
    }
  }, [screenMode, gameOver, isPaused, isSubmittingResign, isSyncingSnapshot, moveHistory.length, matchMode, botSeat, session, state.turn, applySnapshot, syncSnapshot, toGameErrorMessage]);

  const retrySync = useCallback(async () => {
    if (matchMode !== "online" || !onlineGameId) {
      return;
    }

    const synced = await syncSnapshot(onlineGameId, { showDialog: false });
    if (synced) {
      setNetworkBannerMessage(null);
      setGameMessage(null);
    }
  }, [matchMode, onlineGameId, syncSnapshot]);

  if (screenMode === "setup") {
    return (
      <SetupScreen
        setupMode={setupMode}
        passphrase={passphrase}
        spectateGameId={spectateGameId}
        joinName={joinName}
        botName={botName}
        botSeat={botSeat}
        joinErrors={joinErrors}
        spectateErrors={spectateErrors}
        joinMessage={joinMessage}
        spectateMessage={spectateMessage}
        botMessage={botMessage}
        spectatorUrl={spectatorUrl}
        isJoining={isJoining || isRestoringSession}
        isStartingSpectate={isStartingSpectate}
        isStartingBot={isStartingBot}
        onSetupModeChange={onSetupModeChange}
        onPassphraseChange={setPassphrase}
        onSpectateGameIdChange={setSpectateGameId}
        onJoinNameChange={setJoinName}
        onBotNameChange={setBotName}
        onBotSeatChange={setBotSeat}
        onBotStart={onStartBotGame}
        onJoinSubmit={onJoinGame}
        onSpectateSubmit={() => {
          void onStartSpectate();
        }}
      />
    );
  }

  const turnLockMessage = getTurnLockMessage({
    screenMode,
    sessionSeat: playerSeat,
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
        : isSpectatorMode
          ? `観戦中: ${winnerLabel(state.turn)}の手番`
          : `手番: ${winnerLabel(state.turn)}`;

  const displayClockState = useMemo(() => {
    if (screenMode !== "game" || matchMode !== "online" || gameOver) {
      return clockState;
    }

    return projectClockState(clockState, state.turn, clockTurnStartedAtMs, clockNowMs);
  }, [screenMode, matchMode, gameOver, clockState, state.turn, clockTurnStartedAtMs, clockNowMs]);

  const boardPerspective: Color = playerSeat === "white" ? "white" : "black";
  const topSideColor: Color = boardPerspective === "white" ? "black" : "white";
  const bottomSideColor: Color = oppositeColor(topSideColor);

  return (
    <main className="app">
      <h1>将棋倶楽部2.4</h1>
      {session ? (
        <p className="session-summary">
          {matchMode === "online"
            ? `gameId: ${session.gameId} / 先後: ${winnerLabel(session.seat)} / name: ${session.displayName} / version: ${gameVersion}`
            : `mode: bot / 先後: ${winnerLabel(session.seat)} / name: ${session.displayName} / version: ${gameVersion}`}
        </p>
      ) : matchMode === "online" && spectatorGameId ? (
        <p className="session-summary">mode: spectator / gameId: {spectatorGameId} / version: {gameVersion}</p>
      ) : null}
      {matchMode === "online" && networkBannerMessage ? (
        <section className={`network-banner ${isOffline ? "is-offline" : ""}`.trim()} role="status" aria-live="polite">
          <span>{networkBannerMessage}</span>
          <button
            type="button"
            className="network-retry-button"
            onClick={() => {
              void retrySync();
            }}
            disabled={matchMode !== "online" || !onlineGameId || isSyncingSnapshot || isSpectatorMode}
          >
            再試行
          </button>
        </section>
      ) : null}
      <section className="game-actions" aria-label="game actions">
        <button
          type="button"
          className="setup-button"
          onClick={() => setIsPaused((current) => !current)}
          disabled={gameOver || isSubmittingMove || isSyncingSnapshot || isSubmittingResign || isSpectatorMode}
        >
          {isPaused ? "再開" : "一時停止"}
        </button>
        {matchMode === "online" && !isSpectatorMode ? (
          <button
            type="button"
            className="setup-button"
            onClick={() => {
              void retrySync();
            }}
            disabled={!onlineGameId || isSyncingSnapshot}
          >
            再取得
          </button>
        ) : null}
        <button type="button" className="setup-button" onClick={returnToSetup}>
          設定画面へ戻る
        </button>
      </section>
      {turnLockMessage && !gameMessage ? <p className="turn-lock-message">{turnLockMessage}</p> : null}
      <section className="game-area">
        <div className="hand-anchor hand-anchor-white">
          <Hand
            hands={state.hands}
            color={topSideColor}
            active={canOperateNow && playerSeat === topSideColor}
            selectedDrop={selectedDrop}
            onSelectDrop={toggleDropSelection}
          />
          <div className="clock-panel">
            <p className="clock-title">持ち時間</p>
            <p className="clock-main">{formatClockText(displayClockState.main[topSideColor], displayClockState.byo[topSideColor])}</p>
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
          perspective={boardPerspective}
          onSquareClick={onSquareClick}
        />

        <div className="hand-anchor hand-anchor-black">
          <div className="clock-panel">
            <p className="clock-title">持ち時間</p>
            <p className="clock-main">{formatClockText(displayClockState.main[bottomSideColor], displayClockState.byo[bottomSideColor])}</p>
          </div>
          <Hand
            hands={state.hands}
            color={bottomSideColor}
            active={canOperateNow && playerSeat === bottomSideColor}
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
          disabled={gameOver || isPaused || isSubmittingResign || isSubmittingMove || isSyncingSnapshot || isSpectatorMode}
          onClick={() => {
            void resign();
          }}
        >
          {isSubmittingResign ? "投了中..." : "投了"}
        </button>
        {matchMode === "online" && gameOver && !showRestartDialog && session ? (
          <button
            type="button"
            className="restart-button"
            onClick={() => {
              void retrySync();
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
