import type { ClockState } from "../game/timeControl";
import type { GameSnapshot } from "./gameApi";
export type { GameSnapshot } from "./gameApi";

function winnerLabel(winner: GameSnapshot["winner"]): string {
  if (winner === "black") {
    return "先手";
  }
  if (winner === "white") {
    return "後手";
  }
  return "引き分け";
}

function resultLabel(resultType: GameSnapshot["resultType"]): string {
  switch (resultType) {
    case "resign":
      return "投了";
    case "timeout":
      return "時間切れ";
    case "checkmate":
      return "詰み";
    case "repetition":
      return "千日手";
    default:
      return "終局";
  }
}

export function toClockState(snapshot: GameSnapshot): ClockState {
  return {
    main: {
      black: snapshot.mainSecondsBlack,
      white: snapshot.mainSecondsWhite,
    },
    byo: {
      black: snapshot.byoSecondsBlack,
      white: snapshot.byoSecondsWhite,
    },
  };
}

export function projectClockState(snapshot: GameSnapshot, serverNowMs: number): ClockState {
  const projected = toClockState(snapshot);
  if (snapshot.status !== "active") {
    return projected;
  }

  const elapsedSeconds = Math.floor(Math.max(0, serverNowMs - snapshot.turnStartedAtMs) / 1000);
  if (elapsedSeconds <= 0) {
    return projected;
  }

  const activeSeat = snapshot.turn;
  const consumedMain = Math.min(elapsedSeconds, projected.main[activeSeat]);
  projected.main[activeSeat] -= consumedMain;
  const overtime = elapsedSeconds - consumedMain;
  projected.byo[activeSeat] = Math.max(0, projected.byo[activeSeat] - overtime);
  return projected;
}

export function buildResultText(snapshot: GameSnapshot): string | null {
  if (snapshot.status !== "finished") {
    return null;
  }
  return `${winnerLabel(snapshot.winner)}の勝ち（${resultLabel(snapshot.resultType)}）`;
}
