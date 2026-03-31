import type { PersistedGame } from "./storeTypes";
import { oppositeSeat } from "./storeSeatLogic";

export type TurnClockProjection = {
  remainingMainSeconds: number;
  remainingByoSeconds: number;
  timedOut: boolean;
};

export type SnapshotClockProjection = {
  mainSecondsBlack: number;
  mainSecondsWhite: number;
  byoSecondsBlack: number;
  byoSecondsWhite: number;
  turnStartedAtMs: number;
  timedOut: boolean;
};

export function getElapsedWholeSeconds(turnStartedAtMs: number, nowMs: number): number {
  return Math.floor(Math.max(0, nowMs - turnStartedAtMs) / 1000);
}

export function projectTurnClock(mainSeconds: number, byoSeconds: number, elapsedSeconds: number): TurnClockProjection {
  if (elapsedSeconds <= 0) {
    return {
      remainingMainSeconds: mainSeconds,
      remainingByoSeconds: byoSeconds,
      timedOut: false,
    };
  }

  if (elapsedSeconds <= mainSeconds) {
    return {
      remainingMainSeconds: mainSeconds - elapsedSeconds,
      remainingByoSeconds: byoSeconds,
      timedOut: false,
    };
  }

  const overtime = elapsedSeconds - mainSeconds;
  return {
    remainingMainSeconds: 0,
    remainingByoSeconds: Math.max(0, byoSeconds - overtime),
    timedOut: overtime > byoSeconds,
  };
}

export function projectClockForSnapshot(game: PersistedGame, nowMs: number): SnapshotClockProjection {
  const base: SnapshotClockProjection = {
    mainSecondsBlack: game.mainSecondsBlack,
    mainSecondsWhite: game.mainSecondsWhite,
    byoSecondsBlack: game.byoSecondsBlack,
    byoSecondsWhite: game.byoSecondsWhite,
    turnStartedAtMs: game.turnStartedAtMs,
    timedOut: false,
  };

  if (game.status !== "active") {
    return base;
  }

  const elapsedSeconds = getElapsedWholeSeconds(game.turnStartedAtMs, nowMs);
  if (elapsedSeconds <= 0) {
    return base;
  }

  if (game.turn === "black") {
    const projected = projectTurnClock(game.mainSecondsBlack, game.byoSecondsBlack, elapsedSeconds);
    return {
      ...base,
      mainSecondsBlack: projected.remainingMainSeconds,
      byoSecondsBlack: projected.remainingByoSeconds,
      turnStartedAtMs: game.turnStartedAtMs + elapsedSeconds * 1000,
      timedOut: projected.timedOut,
    };
  }

  const projected = projectTurnClock(game.mainSecondsWhite, game.byoSecondsWhite, elapsedSeconds);
  return {
    ...base,
    mainSecondsWhite: projected.remainingMainSeconds,
    byoSecondsWhite: projected.remainingByoSeconds,
    turnStartedAtMs: game.turnStartedAtMs + elapsedSeconds * 1000,
    timedOut: projected.timedOut,
  };
}

export function consumeElapsedClock(game: PersistedGame, nowMs: number): boolean {
  if (game.status !== "active") {
    return false;
  }

  const elapsedSeconds = getElapsedWholeSeconds(game.turnStartedAtMs, nowMs);
  if (elapsedSeconds <= 0) {
    return false;
  }

  if (game.turn === "black") {
    const projected = projectTurnClock(game.mainSecondsBlack, game.byoSecondsBlack, elapsedSeconds);
    game.mainSecondsBlack = projected.remainingMainSeconds;
    game.turnStartedAtMs += elapsedSeconds * 1000;
    if (!projected.timedOut) {
      return false;
    }
  } else {
    const projected = projectTurnClock(game.mainSecondsWhite, game.byoSecondsWhite, elapsedSeconds);
    game.mainSecondsWhite = projected.remainingMainSeconds;
    game.turnStartedAtMs += elapsedSeconds * 1000;
    if (!projected.timedOut) {
      return false;
    }
  }

  game.status = "finished";
  game.resultType = "timeout";
  game.winner = oppositeSeat(game.turn);
  game.updatedAt = new Date(nowMs).toISOString();
  game.version += 1;
  return true;
}

export function settleTimeoutIfNeeded(game: PersistedGame, nowMs: number): boolean {
  const projected = projectClockForSnapshot(game, nowMs);
  if (!projected.timedOut) {
    return false;
  }

  game.mainSecondsBlack = projected.mainSecondsBlack;
  game.mainSecondsWhite = projected.mainSecondsWhite;
  game.turnStartedAtMs = projected.turnStartedAtMs;
  game.status = "finished";
  game.resultType = "timeout";
  game.winner = oppositeSeat(game.turn);
  game.updatedAt = new Date(nowMs).toISOString();
  game.version += 1;
  return true;
}
