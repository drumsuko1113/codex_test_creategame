import type { GameSnapshot } from "./gameApi";

const EVENT_PATH_PREFIX = "/api/games";
const SNAPSHOT_EVENT_TYPES = new Set(["game.updated", "game.finished"]);

type RealtimeEnvelope = {
  type?: unknown;
  payload?: unknown;
};

function normalizeBaseUrl(baseUrl?: string): string {
  const envBase = typeof import.meta !== "undefined" ? (import.meta.env?.VITE_API_BASE_URL as string | undefined) : undefined;
  const selected = baseUrl ?? envBase ?? "";
  return selected.endsWith("/") ? selected.slice(0, -1) : selected;
}

function toWebSocketBaseUrl(baseUrl: string): string {
  if (baseUrl.startsWith("https://")) {
    return `wss://${baseUrl.slice("https://".length)}`;
  }
  if (baseUrl.startsWith("http://")) {
    return `ws://${baseUrl.slice("http://".length)}`;
  }
  return baseUrl;
}

function isGameSnapshot(value: unknown): value is GameSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GameSnapshot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.version === "number" &&
    typeof candidate.status === "string" &&
    typeof candidate.turn === "string" &&
    candidate.state !== undefined
  );
}

export function buildGameEventsWebSocketUrl(gameId: string, baseUrl?: string): string {
  const path = `${EVENT_PATH_PREFIX}/${encodeURIComponent(gameId)}/events`;
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return path;
  }
  return `${toWebSocketBaseUrl(normalized)}${path}`;
}

export function parseRealtimeSnapshotMessage(rawData: unknown): GameSnapshot | null {
  if (typeof rawData !== "string") {
    return null;
  }

  let parsed: RealtimeEnvelope;
  try {
    parsed = JSON.parse(rawData) as RealtimeEnvelope;
  } catch {
    return null;
  }

  if (!SNAPSHOT_EVENT_TYPES.has(String(parsed.type))) {
    return null;
  }

  return isGameSnapshot(parsed.payload) ? parsed.payload : null;
}
