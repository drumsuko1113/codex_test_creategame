import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Move } from "../../core/src/types";
import { readJsonBody, writeJson } from "./http";
import { log } from "./logger";
import { requireSessionAuth } from "./middleware";
import { RateLimiter } from "./rateLimiter";
import { RealtimeHub } from "./realtime";
import { InMemoryStore } from "./store";
import type { CreateGameInput, JoinGameInput } from "./types";

const store = new InMemoryStore();
const rateLimiter = new RateLimiter(60_000, 120);
const realtime = new RealtimeHub();

type MoveRequestBody = {
  move: Move;
  expectedVersion: number;
};

type RequestContext = {
  requestId: string;
  method: string;
  path: string;
};

function makeRequestContext(req: IncomingMessage): RequestContext {
  const headerValue = req.headers["x-request-id"];
  const requestId = typeof headerValue === "string" && headerValue ? headerValue : randomUUID();
  return {
    requestId,
    method: req.method ?? "UNKNOWN",
    path: req.url ?? "",
  };
}

function respond(
  res: ServerResponse,
  ctx: RequestContext,
  statusCode: number,
  body: unknown,
  meta?: { gameId?: string; guestId?: string; event?: string },
): void {
  res.setHeader("x-request-id", ctx.requestId);
  writeJson(res, statusCode, body);
  log({
    level: "info",
    event: meta?.event ?? "http.response",
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    statusCode,
    gameId: meta?.gameId,
    guestId: meta?.guestId,
  });
}

function respondError(
  res: ServerResponse,
  ctx: RequestContext,
  statusCode: number,
  code: string,
  message: string,
  meta?: { gameId?: string; guestId?: string; event?: string },
): void {
  respond(res, ctx, statusCode, { error: { code, message } }, meta);
}

function isValidCreateGameInput(input: CreateGameInput): boolean {
  if (!Number.isInteger(input.mainMinutes) || input.mainMinutes <= 0) {
    return false;
  }
  if (!Number.isInteger(input.byoSeconds) || input.byoSeconds < 0) {
    return false;
  }
  return input.byoSeconds === 0 || input.byoSeconds % 10 === 0;
}

function isValidJoinGameInput(input: JoinGameInput): boolean {
  const trimmed = input.name?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
    return false;
  }
  if (input.seat !== "black" && input.seat !== "white") {
    return false;
  }
  return typeof input.joinToken === "string" && input.joinToken.length >= 16;
}

function isMoveRequestBody(input: unknown): input is MoveRequestBody {
  if (!input || typeof input !== "object") {
    return false;
  }
  const body = input as Record<string, unknown>;
  return typeof body.expectedVersion === "number" && Number.isInteger(body.expectedVersion) && "move" in body;
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
    const body = await readJsonBody<CreateGameInput>(req);
    if (!isValidCreateGameInput(body)) {
      respondError(res, ctx, 400, "INVALID_CREATE_GAME_PAYLOAD", "Invalid create game payload");
      return;
    }

    const created = store.createGame(body);
    respond(res, ctx, 201, created, { gameId: created.gameId, event: "game.created" });
    realtime.broadcast(created.gameId, "game.created", created);
    return;
  }

  const joinMatch = req.url?.match(/^\/api\/games\/([^/]+)\/join$/);
  if (req.method === "POST" && joinMatch) {
    const gameId = joinMatch[1];
    const body = await readJsonBody<JoinGameInput>(req);
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
      const code = error instanceof Error ? error.message : "UNKNOWN";
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

  const recordsMatch = req.url?.match(/^\/api\/games\/([^/]+)\/records$/);
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

  const getGameMatch = req.url?.match(/^\/api\/games\/([^/]+)$/);
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

  const moveMatch = req.url?.match(/^\/api\/games\/([^/]+)\/moves$/);
  if (req.method === "POST" && moveMatch) {
    const gameId = moveMatch[1];

    let actor;
    try {
      actor = requireSessionAuth(req, store, gameId);
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNAUTHORIZED";
      if (code === "UNAUTHORIZED") {
        respondError(res, ctx, 401, code, "Session token is missing or invalid", { gameId });
        return;
      }
      throw error;
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
      const message = error instanceof Error ? error.message : "UNKNOWN";
      if (message === "GAME_NOT_FOUND") {
        respondError(res, ctx, 404, message, "Game was not found", { gameId, guestId: actor.guestId });
        return;
      }
      if (message === "GAME_NOT_ACTIVE" || message === "NOT_YOUR_TURN" || message === "VERSION_CONFLICT") {
        respondError(res, ctx, 409, message, "Move cannot be applied in current game state", { gameId, guestId: actor.guestId });
        return;
      }
      if (message.startsWith("ILLEGAL_MOVE:")) {
        respondError(res, ctx, 400, "ILLEGAL_MOVE", message, { gameId, guestId: actor.guestId });
        return;
      }
      throw error;
    }
  }

  const resignMatch = req.url?.match(/^\/api\/games\/([^/]+)\/resign$/);
  if (req.method === "POST" && resignMatch) {
    const gameId = resignMatch[1];

    let actor;
    try {
      actor = requireSessionAuth(req, store, gameId);
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNAUTHORIZED";
      if (code === "UNAUTHORIZED") {
        respondError(res, ctx, 401, code, "Session token is missing or invalid", { gameId });
        return;
      }
      throw error;
    }

    try {
      const updated = store.resign(gameId, actor);
      respond(res, ctx, 200, updated, { gameId, guestId: actor.guestId, event: "game.resigned" });
      realtime.broadcast(gameId, "game.finished", updated);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN";
      if (message === "GAME_NOT_FOUND") {
        respondError(res, ctx, 404, message, "Game was not found", { gameId, guestId: actor.guestId });
        return;
      }
      if (message === "GAME_ALREADY_FINISHED") {
        respondError(res, ctx, 409, message, "Game is already finished", { gameId, guestId: actor.guestId });
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
      const message = error instanceof Error ? error.message : "Internal Server Error";
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
