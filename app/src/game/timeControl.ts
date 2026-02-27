import { type Color } from "../../../core/src/types";

export type TimeControl = {
  mainSeconds: number;
  byoSeconds: number;
};

export type ClockState = {
  main: Record<Color, number>;
  byo: Record<Color, number>;
};

export const DEFAULT_TIME_CONTROL: TimeControl = { mainSeconds: 600, byoSeconds: 30 };

export function createClockState(control: TimeControl): ClockState {
  return {
    main: { black: control.mainSeconds, white: control.mainSeconds },
    byo: { black: control.byoSeconds, white: control.byoSeconds },
  };
}

export function formatSeconds(seconds: number): string {
  const s = Math.max(0, seconds);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatClockText(mainSeconds: number, byoSeconds: number): string {
  if (mainSeconds > 0) {
    return formatSeconds(mainSeconds);
  }

  return `秒読み ${formatSeconds(byoSeconds)}`;
}

export function projectClockState(base: ClockState, turn: Color, turnStartedAtMs: number, nowMs: number): ClockState {
  const elapsedSeconds = Math.floor(Math.max(0, nowMs - turnStartedAtMs) / 1000);
  if (elapsedSeconds <= 0) {
    return base;
  }

  const projected: ClockState = {
    main: { ...base.main },
    byo: { ...base.byo },
  };

  const mainSeconds = base.main[turn];
  const byoSeconds = base.byo[turn];
  if (elapsedSeconds <= mainSeconds) {
    projected.main[turn] = mainSeconds - elapsedSeconds;
    return projected;
  }

  const overtime = elapsedSeconds - mainSeconds;
  projected.main[turn] = 0;
  projected.byo[turn] = Math.max(0, byoSeconds - overtime);
  return projected;
}

export function normalizeTimeControl(mainMinutes: number, byoSeconds: number): TimeControl {
  return {
    mainSeconds: Math.max(0, Math.floor(mainMinutes)) * 60,
    byoSeconds: Math.max(0, Math.floor(byoSeconds / 10) * 10),
  };
}
