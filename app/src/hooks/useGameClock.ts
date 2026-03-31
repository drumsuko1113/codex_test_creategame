import { useEffect, useMemo, useState } from "react";
import {
  createClockState,
  projectClockState,
  type ClockState,
  type TimeControl,
} from "../game/timeControl";
import type { Color } from "../../../core/src/types";

type UseGameClockParams = {
  screenMode: "setup" | "game";
  matchMode: "online" | "bot";
  gameOver: boolean;
  turn: Color;
};

export function useGameClock(initialTimeControl: TimeControl, params: UseGameClockParams) {
  const { screenMode, matchMode, gameOver, turn } = params;

  const [clockState, setClockState] = useState<ClockState>(() => createClockState(initialTimeControl));
  const [clockTurnStartedAtMs, setClockTurnStartedAtMs] = useState<number>(() => Date.now());
  const [clockNowMs, setClockNowMs] = useState<number>(() => Date.now());

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

  const displayClockState = useMemo(() => {
    if (screenMode !== "game" || matchMode !== "online" || gameOver) {
      return clockState;
    }

    return projectClockState(clockState, turn, clockTurnStartedAtMs, clockNowMs);
  }, [screenMode, matchMode, gameOver, clockState, turn, clockTurnStartedAtMs, clockNowMs]);

  return {
    clockState,
    setClockState,
    clockTurnStartedAtMs,
    setClockTurnStartedAtMs,
    displayClockState,
  };
}
