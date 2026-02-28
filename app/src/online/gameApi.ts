import type { GameState, Move } from "../../../core/src/types";

type Seat = "black" | "white";
type GameStatus = "waiting" | "active" | "finished";
type ResultType = "checkmate" | "resign" | "timeout" | "repetition";

export type CreateGameRequest = {
  mainMinutes: number;
  byoSeconds: number;
};

export type CreateGameResponse = {
  gameId: string;
  joinToken: string;
};

export type JoinGameRequest = {
  gameId: string;
  joinToken: string;
  name: string;
  seat: Seat;
};

export type JoinGameResponse = {
  guestId: string;
  sessionToken: string;
  managedToken: string | null;
  seat: Seat;
};

export type MatchLobbyRequest = {
  passphrase: string;
  name: string;
};

export type MatchLobbyResponse = {
  gameId: string;
  guestId: string;
  sessionToken: string;
  managedToken: string | null;
  seat: Seat;
};

export type GameSnapshot = {
  id: string;
  status: GameStatus;
  turn: Seat;
  state: GameState;
  mainSecondsBlack: number;
  mainSecondsWhite: number;
  byoSecondsBlack: number;
  byoSecondsWhite: number;
  resultType: ResultType | null;
  winner: Seat | null;
  version: number;
  turnStartedAtMs: number;
  createdAt: string;
  updatedAt: string;
};

export type SubmitMoveRequest = {
  gameId: string;
  sessionToken: string;
  expectedVersion: number;
  move: Move;
};

export type ResignGameRequest = {
  gameId: string;
  sessionToken: string;
};

export type GetSessionPlayerRequest = {
  gameId: string;
  sessionToken: string;
};

export type SessionPlayerResponse = {
  gameId: string;
  guestId: string;
  seat: Seat;
  displayName: string;
};

type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

type ApiHeaders = Record<string, string>;

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function normalizeBaseUrl(baseUrl?: string): string {
  const envBase = typeof import.meta !== "undefined" ? (import.meta.env?.VITE_API_BASE_URL as string | undefined) : undefined;
  const selected = baseUrl ?? envBase ?? "";
  return selected.endsWith("/") ? selected.slice(0, -1) : selected;
}

function buildApiUrl(path: string, baseUrl?: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized ? `${normalized}${path}` : path;
}

function requestApiJson<T>(path: string, baseUrl?: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(buildApiUrl(path, baseUrl), init);
}

function buildAuthHeaders(sessionToken: string): ApiHeaders {
  return {
    authorization: `Bearer ${sessionToken}`,
  };
}

function buildJsonHeaders(headers?: ApiHeaders): ApiHeaders {
  return {
    "content-type": "application/json",
    ...(headers ?? {}),
  };
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Network request failed");
  }

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    const errorBody = payload as ErrorPayload | null;
    const code = errorBody?.error?.code ?? "HTTP_ERROR";
    const message = errorBody?.error?.message ?? `HTTP ${response.status}`;
    throw new ApiClientError(response.status, code, message);
  }

  return payload as T;
}

export async function createGame(input: CreateGameRequest, baseUrl?: string): Promise<CreateGameResponse> {
  return requestApiJson<CreateGameResponse>("/api/games", baseUrl, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify(input),
  });
}

export async function joinGame(input: JoinGameRequest, baseUrl?: string): Promise<JoinGameResponse> {
  return requestApiJson<JoinGameResponse>(`/api/games/${input.gameId}/join`, baseUrl, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      name: input.name,
      seat: input.seat,
      joinToken: input.joinToken,
    }),
  });
}

export async function matchLobby(input: MatchLobbyRequest, baseUrl?: string): Promise<MatchLobbyResponse> {
  return requestApiJson<MatchLobbyResponse>("/api/lobby/match", baseUrl, {
    method: "POST",
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      passphrase: input.passphrase,
      name: input.name,
    }),
  });
}

export async function getGameSnapshot(gameId: string, baseUrl?: string): Promise<GameSnapshot> {
  return requestApiJson<GameSnapshot>(`/api/games/${gameId}`, baseUrl);
}

export async function getSessionPlayer(input: GetSessionPlayerRequest, baseUrl?: string): Promise<SessionPlayerResponse> {
  return requestApiJson<SessionPlayerResponse>(`/api/games/${input.gameId}/me`, baseUrl, {
    headers: buildAuthHeaders(input.sessionToken),
  });
}

export async function submitMove(input: SubmitMoveRequest, baseUrl?: string): Promise<GameSnapshot> {
  return requestApiJson<GameSnapshot>(`/api/games/${input.gameId}/moves`, baseUrl, {
    method: "POST",
    headers: buildJsonHeaders(buildAuthHeaders(input.sessionToken)),
    body: JSON.stringify({
      expectedVersion: input.expectedVersion,
      move: input.move,
    }),
  });
}

export async function resignGame(input: ResignGameRequest, baseUrl?: string): Promise<GameSnapshot> {
  return requestApiJson<GameSnapshot>(`/api/games/${input.gameId}/resign`, baseUrl, {
    method: "POST",
    headers: buildAuthHeaders(input.sessionToken),
  });
}
