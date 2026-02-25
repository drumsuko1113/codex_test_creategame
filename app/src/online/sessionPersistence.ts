import type { Color } from "../../../core/src/types";

export type StoredSession = {
  gameId: string;
  sessionToken: string;
  seat: Color;
  displayName: string;
};

export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const SESSION_STORAGE_KEY = "shogi.online.session.v1";

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage;
  }
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function isColor(value: unknown): value is Color {
  return value === "black" || value === "white";
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<StoredSession>;
  return (
    typeof candidate.gameId === "string" &&
    candidate.gameId.length > 0 &&
    typeof candidate.sessionToken === "string" &&
    candidate.sessionToken.length > 0 &&
    isColor(candidate.seat) &&
    typeof candidate.displayName === "string"
  );
}

export function saveStoredSession(session: StoredSession, storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) {
    return;
  }
  try {
    target.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore quota and serialization errors.
  }
}

export function loadStoredSession(storage?: StorageLike): StoredSession | null {
  const target = resolveStorage(storage);
  if (!target) {
    return null;
  }

  try {
    const raw = target.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearStoredSession(storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) {
    return;
  }
  try {
    target.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage access errors.
  }
}
