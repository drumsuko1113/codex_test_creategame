import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readJsonBody } from "./http";
import { makeRequestContext } from "./context";
import { log } from "./logger";
import { requireSessionAuth } from "./middleware";
import { RateLimiter } from "./rateLimiter";
import { RealtimeHub } from "./realtime";
import { respond, respondError } from "./respond";
import { ROUTE_JOIN, ROUTE_ME, ROUTE_MOVE, ROUTE_RECORDS, ROUTE_RESIGN, ROUTE_SNAPSHOT } from "./routePatterns";
import { createDefaultStore, type GameStore } from "./store";
import type { Player } from "./types";
import { isMoveRequestBody, isValidCreateGameInput, isValidJoinGameInput } from "./validators";

type AppOptions = {
  store?: GameStore;
};

type ErrorRule = {
  match: (code: string) => boolean;
  statusCode: number;
  message: string | ((code: string) => string);
  responseCode?: string;
};

function getErrorCode(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function exactCode(code: string): (value: string) => boolean {
  return (value) => value === code;
}

function prefixCode(prefix: string): (value: string) => boolean {
  return (value) => value.startsWith(prefix);
}

function respondIfMappedError(
  res: ServerResponse,
  ctx: ReturnType<typeof makeRequestContext>,
  code: string,
  meta: { gameId: string; guestId?: string },
  rules: readonly ErrorRule[],
): boolean {
  const matched = rules.find((rule) => rule.match(code));
  if (!matched) {
    return false;
  }

  respondError(
    res,
    ctx,
    matched.statusCode,
    matched.responseCode ?? code,
    typeof matched.message === "function" ? matched.message(code) : matched.message,
    { gameId: meta.gameId, guestId: meta.guestId },
  );
  return true;
}

const JOIN_ERROR_RULES: readonly ErrorRule[] = [
  { match: exactCode("GAME_NOT_FOUND"), statusCode: 404, message: "Game was not found" },
  { match: exactCode("INVALID_JOIN_TOKEN"), statusCode: 401, message: "Join token is invalid" },
  { match: exactCode("GAME_IS_FULL"), statusCode: 409, message: "Seat is unavailable" },
  { match: exactCode("SEAT_ALREADY_TAKEN"), statusCode: 409, message: "Seat is unavailable" },
];

const MOVE_ERROR_RULES: readonly ErrorRule[] = [
  { match: exactCode("GAME_NOT_FOUND"), statusCode: 404, message: "Game was not found" },
  { match: exactCode("GAME_NOT_ACTIVE"), statusCode: 409, message: "Move cannot be applied in current game state" },
  { match: exactCode("NOT_YOUR_TURN"), statusCode: 409, message: "Move cannot be applied in current game state" },
  { match: exactCode("VERSION_CONFLICT"), statusCode: 409, message: "Move cannot be applied in current game state" },
  { match: prefixCode("ILLEGAL_MOVE:"), statusCode: 400, message: (code) => code, responseCode: "ILLEGAL_MOVE" },
];

const RESIGN_ERROR_RULES: readonly ErrorRule[] = [
  { match: exactCode("GAME_NOT_FOUND"), statusCode: 404, message: "Game was not found" },
  { match: exactCode("GAME_ALREADY_FINISHED"), statusCode: 409, message: "Game is already finished" },
];

async function authenticateActor(
  req: IncomingMessage,
  res: ServerResponse,
  store: GameStore,
  gameId: string,
  ctx: ReturnType<typeof makeRequestContext>,
): Promise<Player | null> {
  try {
    return await requireSessionAuth(req, store, gameId);
  } catch (error) {
    const code = getErrorCode(error, "UNAUTHORIZED");
    if (code === "UNAUTHORIZED") {
      respondError(res, ctx, 401, code, "Session token is missing or invalid", { gameId });
      return null;
    }
    throw error;
  }
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  store: GameStore,
  rateLimiter: RateLimiter,
  realtime: RealtimeHub,
): Promise<void> {
  const ctx = makeRequestContext(req);

  if (ctx.path.startsWith("/api/")) {
    const ip = req.socket.remoteAddress ?? "unknown";
    if (!rateLimiter.consume(ip)) {
      respondError(res, ctx, 429, "RATE_LIMIT_EXCEEDED", "Too many requests");
      return;
    }
  }

  if (req.method === "GET" && req.url === "/health") {
    respond(res, ctx, 200, { ok: true }, { event: "health" });
    return;
  }

  if (req.method === "POST" && req.url === "/api/games") {
    const body = await readJsonBody<unknown>(req);
    if (!isValidCreateGameInput(body)) {
      respondError(res, ctx, 400, "INVALID_CREATE_GAME_PAYLOAD", "Invalid create game payload");
      return;
    }

    const created = await store.createGame(body);
    respond(res, ctx, 201, created, { gameId: created.gameId, event: "game.created" });
    realtime.broadcast(created.gameId, "game.created", created);
    return;
  }

  const joinMatch = req.url?.match(ROUTE_JOIN);
  if (req.method === "POST" && joinMatch) {
    const gameId = joinMatch[1];
    const body = await readJsonBody<unknown>(req);
    if (!isValidJoinGameInput(body)) {
      respondError(res, ctx, 400, "INVALID_JOIN_PAYLOAD", "Invalid join payload", { gameId });
      return;
    }

    try {
      const joined = await store.joinGame(gameId, body);
      respond(res, ctx, 200, joined, { gameId, guestId: joined.guestId, event: "game.joined" });
      realtime.broadcast(gameId, "player.joined", joined);
      return;
    } catch (error) {
      const code = getErrorCode(error, "UNKNOWN");
      if (respondIfMappedError(res, ctx, code, { gameId }, JOIN_ERROR_RULES)) {
        return;
      }
      throw error;
    }
  }

  const recordsMatch = req.url?.match(ROUTE_RECORDS);
  if (req.method === "GET" && recordsMatch) {
    const gameId = recordsMatch[1];
    const game = await store.getGame(gameId);
    if (!game) {
      respondError(res, ctx, 404, "GAME_NOT_FOUND", "Game was not found", { gameId });
      return;
    }

    respond(
      res,
      ctx,
      200,
      {
        gameId,
        status: game.status,
        winner: game.winner,
        resultType: game.resultType,
        moves: await store.getMoves(gameId),
      },
      { gameId, event: "game.records" },
    );
    return;
  }

  const getGameMatch = req.url?.match(ROUTE_SNAPSHOT);
  if (req.method === "GET" && getGameMatch) {
    const gameId = getGameMatch[1];
    const game = await store.getGame(gameId);
    if (!game) {
      respondError(res, ctx, 404, "GAME_NOT_FOUND", "Game was not found", { gameId });
      return;
    }
    respond(res, ctx, 200, game, { gameId, event: "game.snapshot" });
    return;
  }

  const meMatch = req.url?.match(ROUTE_ME);
  if (req.method === "GET" && meMatch) {
    const gameId = meMatch[1];
    const actor = await authenticateActor(req, res, store, gameId, ctx);
    if (!actor) {
      return;
    }

    respond(
      res,
      ctx,
      200,
      {
        gameId,
        guestId: actor.guestId,
        seat: actor.seat,
        displayName: actor.displayName,
      },
      { gameId, guestId: actor.guestId, event: "game.me" },
    );
    return;
  }

  const moveMatch = req.url?.match(ROUTE_MOVE);
  if (req.method === "POST" && moveMatch) {
    const gameId = moveMatch[1];
    const actor = await authenticateActor(req, res, store, gameId, ctx);
    if (!actor) {
      return;
    }

    const body = await readJsonBody<unknown>(req);
    if (!isMoveRequestBody(body)) {
      respondError(res, ctx, 400, "INVALID_MOVE_PAYLOAD", "Move payload is invalid", { gameId, guestId: actor.guestId });
      return;
    }

    try {
      const updated = await store.submitMove(gameId, actor, body.move, body.expectedVersion);
      respond(res, ctx, 200, updated, { gameId, guestId: actor.guestId, event: "game.moved" });
      realtime.broadcast(gameId, "game.updated", updated);
      return;
    } catch (error) {
      const code = getErrorCode(error, "UNKNOWN");
      if (respondIfMappedError(res, ctx, code, { gameId, guestId: actor.guestId }, MOVE_ERROR_RULES)) {
        return;
      }
      throw error;
    }
  }

  const resignMatch = req.url?.match(ROUTE_RESIGN);
  if (req.method === "POST" && resignMatch) {
    const gameId = resignMatch[1];
    const actor = await authenticateActor(req, res, store, gameId, ctx);
    if (!actor) {
      return;
    }

    try {
      const updated = await store.resign(gameId, actor);
      respond(res, ctx, 200, updated, { gameId, guestId: actor.guestId, event: "game.resigned" });
      realtime.broadcast(gameId, "game.finished", updated);
      return;
    } catch (error) {
      const code = getErrorCode(error, "UNKNOWN");
      if (respondIfMappedError(res, ctx, code, { gameId, guestId: actor.guestId }, RESIGN_ERROR_RULES)) {
        return;
      }
      throw error;
    }
  }

  respondError(res, ctx, 404, "NOT_FOUND", "Route not found");
}

export function createApp(options: AppOptions = {}) {
  const store = options.store ?? createDefaultStore();
  const rateLimiter = new RateLimiter(60_000, 120);
  const realtime = new RealtimeHub();

  const server = createServer((req, res) => {
    handleRequest(req, res, store, rateLimiter, realtime).catch((error: unknown) => {
      const ctx = makeRequestContext(req);
      const message = getErrorCode(error, "Internal Server Error");
      if (message === "INVALID_JSON") {
        respondError(res, ctx, 400, "INVALID_JSON", "Malformed JSON payload");
        return;
      }
      log({
        level: "error",
        event: "http.error",
        requestId: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        message,
      });
      respondError(res, ctx, 500, "INTERNAL_ERROR", message);
    });
  });

  realtime.attach(server);
  server.on("close", () => {
    if (!store.close) {
      return;
    }
    store.close().catch((error: unknown) => {
      log({
        level: "error",
        event: "store.close.error",
        requestId: "server-close",
        method: "SYSTEM",
        path: "/",
        message: getErrorCode(error, "STORE_CLOSE_ERROR"),
      });
    });
  });
  return server;
}
