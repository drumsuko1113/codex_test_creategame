import { useEffect } from "react";
import { shouldApplySnapshot } from "../online/pollingPolicy";
import { computePollingRetryDelayMs } from "../online/networkRecovery";
import { buildGameEventsWebSocketUrl, parseRealtimeSnapshotMessage } from "../online/realtimeEvents";
import type { GameSnapshot } from "../online/gameApi";

type SyncSnapshotFn = (
  gameId: string,
  options: { showDialog: boolean; suppressError: boolean; onlyIfVersionAdvanced?: boolean; background?: boolean },
) => Promise<boolean>;

type ApplySnapshotFn = (snapshot: GameSnapshot, options: { showDialog: boolean }) => void;

type UseGameWebSocketParams = {
  screenMode: "setup" | "game";
  matchMode: "online" | "bot";
  onlineGameId: string | null;
  gameOver: boolean;
  isOffline: boolean;
  syncSnapshot: SyncSnapshotFn;
  applySnapshot: ApplySnapshotFn;
  latestVersionRef: React.RefObject<number>;
  setNetworkBannerMessage: (message: string | null) => void;
  setGameMessage: (message: string | null) => void;
};

export function useGameWebSocket(params: UseGameWebSocketParams): void {
  const {
    screenMode,
    matchMode,
    onlineGameId,
    gameOver,
    isOffline,
    syncSnapshot,
    applySnapshot,
    latestVersionRef,
    setNetworkBannerMessage,
    setGameMessage,
  } = params;

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
  }, [screenMode, matchMode, onlineGameId, gameOver, isOffline, syncSnapshot, applySnapshot, latestVersionRef, setNetworkBannerMessage, setGameMessage]);
}
