import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readJsonBody } from "./http";
import { makeRequestContext } from "./context";
import { log } from "./logger";
import { requireSessionAuth } from "./middleware";
import { RateLimiter } from "./rateLimiter";
import { RealtimeHub } from "./realtime";
import { respond, respondError } from "./respond";
import { ROUTE_JOIN, ROUTE_MOVE, ROUTE_RECORDS, ROUTE_RESIGN, ROUTE_SNAPSHOT } from "./routePatterns";
import { InMemoryStore } from "./store";
import type { Player } from "./types";
import { isMoveRequestBody, isValidCreateGameInput, isValidJoinGameInput } from "./validators";

const store = new InMemoryStore();
const rateLimiter = new RateLimiter(60_000, 120);
const realtime = new RealtimeHub();

function getErrorCode(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function authenticateActor(
  req: IncomingMessage,
  res: ServerResponse,
  gameId: string,
  ctx: ReturnType<typeof makeRequestContext>,
): Player | null {
  try {
    return requireSessionAuth(req, store, gameId);
  } catch (error) {
    const code = getErrorCode(error, "UNAUTHORIZED");
    if (code === "UNAUTHORIZED") {
      respondError(res, ctx, 401, code, "Session token is missing or invalid", { gameId });
      return null;
    }
    throw error;
  }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

    const created = store.createGame(body);
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
      const joined = store.joinGame(gameId, body);
      respond(res, ctx, 200, joined, { gameId, guestId: joined.guestId, event: "game.joined" });
      realtime.broadcast(gameId, "player.joined", joined);
      return;
    } catch (error) {
      const code = getErrorCode(error, "UNKNOWN");
      if (code === "GAME_NOT_FOUND") {
        respondError(res, ctx, 404, code, "Game was not found", { gameId });
        return;
      }
      if (code === "INVALID_JOIN_TOKEN") {
        respondError(res, ctx, 401, code, "Join token is invalid", { gameId });
        return;
      }
      if (code === "GAME_IS_FULL" || code === "SEAT_ALREADY_TAKEN") {
        respondError(res, ctx, 409, code, "Seat is unavailable", { gameId });
        return;
      }
      throw error;
    }
  }

  const recordsMatch = req.url?.match(ROUTE_RECORDS);
  if (req.method === "GET" && recordsMatch) {
    const gameId = recordsMatch[1];
    const game = store.getGame(gameId);
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
        moves: store.getMoves(gameId),
      },
      { gameId, event: "game.records" },
    );
    return;
  }

  const getGameMatch = req.url?.match(ROUTE_SNAPSHOT);
  if (req.method === "GET" && getGameMatch) {
    const gameId = getGameMatch[1];
    const game = store.getGame(gameId);
    if (!game) {
      respondError(res, ctx, 404, "GAME_NOT_FOUND", "Game was not found", { gameId });
      return;
    }
    respond(res, ctx, 200, game, { gameId, event: "game.snapshot" });
    return;
  }

  const moveMatch = req.url?.match(ROUTE_MOVE);
  if (req.method === "POST" && moveMatch) {
    const gameId = moveMatch[1];
    const actor = authenticateActor(req, res, gameId, ctx);
    if (!actor) {
      return;
    }

    const body = await readJsonBody<unknown>(req);
    if (!isMoveRequestBody(body)) {
      respondError(res, ctx, 400, "INVALID_MOVE_PAYLOAD", "Move payload is invalid", { gameId, guestId: actor.guestId });
      return;
    }

    try {
      const updated = store.submitMove(gameId, actor, body.move, body.expectedVersion);
      respond(res, ctx, 200, updated, { gameId, guestId: actor.guestId, event: "game.moved" });
      realtime.broadcast(gameId, "game.updated", updated);
      return;
    } catch (error) {
      const code = getErrorCode(error, "UNKNOWN");
      if (code === "GAME_NOT_FOUND") {
        respondError(res, ctx, 404, code, "Game was not found", { gameId, guestId: actor.guestId });
        return;
      }
      if (code === "GAME_NOT_ACTIVE" || code === "NOT_YOUR_TURN" || code === "VERSION_CONFLICT") {
        respondError(res, ctx, 409, code, "Move cannot be applied in current game state", { gameId, guestId: actor.guestId });
        return;
      }
      if (code.startsWith("ILLEGAL_MOVE:")) {
        respondError(res, ctx, 400, "ILLEGAL_MOVE", code, { gameId, guestId: actor.guestId });
        return;
      }
      throw error;
    }
  }

  const resignMatch = req.url?.match(ROUTE_RESIGN);
  if (req.method === "POST" && resignMatch) {
    const gameId = resignMatch[1];
    const actor = authenticateActor(req, res, gameId, ctx);
    if (!actor) {
      return;
    }

    try {
      const updated = store.resign(gameId, actor);
      respond(res, ctx, 200, updated, { gameId, guestId: actor.guestId, event: "game.resigned" });
      realtime.broadcast(gameId, "game.finished", updated);
      return;
    } catch (error) {
      const code = getErrorCode(error, "UNKNOWN");
      if (code === "GAME_NOT_FOUND") {
        respondError(res, ctx, 404, code, "Game was not found", { gameId, guestId: actor.guestId });
        return;
      }
      if (code === "GAME_ALREADY_FINISHED") {
        respondError(res, ctx, 409, code, "Game is already finished", { gameId, guestId: actor.guestId });
        return;
      }
      throw error;
    }
  }

  respondError(res, ctx, 404, "NOT_FOUND", "Route not found");
}

export function createApp() {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error: unknown) => {
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
  return server;
}
