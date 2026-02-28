import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { makeRequestContext } from "./context";
import { readJsonBody } from "./http";
import { log } from "./logger";
import { requireSessionAuth } from "./middleware";
import { RateLimiter } from "./rateLimiter";
import { RealtimeHub } from "./realtime";
import { respond, respondError } from "./respond";
import { ROUTE_JOIN, ROUTE_MOVE, ROUTE_RECORDS, ROUTE_RESIGN, ROUTE_SNAPSHOT } from "./routePatterns";
import { InMemoryStore } from "./store";
import type { CreateGameInput, JoinGameInput, Player } from "./types";
import { isMoveRequestBody, isValidCreateGameInput, isValidJoinGameInput } from "./validators";

const store = new InMemoryStore();
const rateLimiter = new RateLimiter(60_000, 120);
const realtime = new RealtimeHub();

type RequestContext = ReturnType<typeof makeRequestContext>;
type ErrorResponse = { statusCode: number; message: string; responseCode?: string };

const JOIN_ERROR_RESPONSES: Record<string, ErrorResponse> = {
  GAME_NOT_FOUND: { statusCode: 404, message: "Game was not found" },
  INVALID_JOIN_TOKEN: { statusCode: 401, message: "Join token is invalid" },
  GAME_IS_FULL: { statusCode: 409, message: "Seat is unavailable" },
  SEAT_ALREADY_TAKEN: { statusCode: 409, message: "Seat is unavailable" },
};

const MOVE_ERROR_RESPONSES: Record<string, ErrorResponse> = {
  GAME_NOT_FOUND: { statusCode: 404, message: "Game was not found" },
  GAME_NOT_ACTIVE: { statusCode: 409, message: "Move cannot be applied in current game state" },
  NOT_YOUR_TURN: { statusCode: 409, message: "Move cannot be applied in current game state" },
  VERSION_CONFLICT: { statusCode: 409, message: "Move cannot be applied in current game state" },
};

const RESIGN_ERROR_RESPONSES: Record<string, ErrorResponse> = {
  GAME_NOT_FOUND: { statusCode: 404, message: "Game was not found" },
  GAME_ALREADY_FINISHED: { statusCode: 409, message: "Game is already finished" },
};

function extractErrorCode(error: unknown, fallback = "UNKNOWN"): string {
  return error instanceof Error ? error.message : fallback;
}

function matchGameId(url: string | undefined, routePattern: RegExp): string | null {
  const matched = url?.match(routePattern);
  return matched ? matched[1] : null;
}

function respondMappedError(
  res: ServerResponse,
  ctx: RequestContext,
  code: string,
  mapping: Record<string, ErrorResponse>,
  meta?: { gameId?: string; guestId?: string },
): boolean {
  const errorResponse = mapping[code];
  if (!errorResponse) {
    return false;
  }

  respondError(
    res,
    ctx,
    errorResponse.statusCode,
    errorResponse.responseCode ?? code,
    errorResponse.message,
    meta,
  );
  return true;
}

function authenticateActor(req: IncomingMessage, res: ServerResponse, gameId: string, ctx: RequestContext): Player | null {
  try {
    return requireSessionAuth(req, store, gameId);
  } catch (error) {
    const code = extractErrorCode(error, "UNAUTHORIZED");
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

  const joinGameId = matchGameId(req.url, ROUTE_JOIN);
  if (req.method === "POST" && joinGameId) {
    const body = await readJsonBody<JoinGameInput>(req);
    if (!isValidJoinGameInput(body)) {
      respondError(res, ctx, 400, "INVALID_JOIN_PAYLOAD", "Invalid join payload", { gameId: joinGameId });
      return;
    }

    try {
      const joined = store.joinGame(joinGameId, body);
      respond(res, ctx, 200, joined, { gameId: joinGameId, guestId: joined.guestId, event: "game.joined" });
      realtime.broadcast(joinGameId, "player.joined", joined);
      return;
    } catch (error) {
      const code = extractErrorCode(error);
      if (respondMappedError(res, ctx, code, JOIN_ERROR_RESPONSES, { gameId: joinGameId })) {
        return;
      }
      throw error;
    }
  }

  const recordsGameId = matchGameId(req.url, ROUTE_RECORDS);
  if (req.method === "GET" && recordsGameId) {
    const game = store.getGame(recordsGameId);
    if (!game) {
      respondError(res, ctx, 404, "GAME_NOT_FOUND", "Game was not found", { gameId: recordsGameId });
      return;
    }

    respond(
      res,
      ctx,
      200,
      {
        gameId: recordsGameId,
        status: game.status,
        winner: game.winner,
        resultType: game.resultType,
        moves: store.getMoves(recordsGameId),
      },
      { gameId: recordsGameId, event: "game.records" },
    );
    return;
  }

  const snapshotGameId = matchGameId(req.url, ROUTE_SNAPSHOT);
  if (req.method === "GET" && snapshotGameId) {
    const game = store.getGame(snapshotGameId);
    if (!game) {
      respondError(res, ctx, 404, "GAME_NOT_FOUND", "Game was not found", { gameId: snapshotGameId });
      return;
    }

    respond(res, ctx, 200, game, { gameId: snapshotGameId, event: "game.snapshot" });
    return;
  }

  const moveGameId = matchGameId(req.url, ROUTE_MOVE);
  if (req.method === "POST" && moveGameId) {
    const actor = authenticateActor(req, res, moveGameId, ctx);
    if (!actor) {
      return;
    }

    const body = await readJsonBody<unknown>(req);
    if (!isMoveRequestBody(body)) {
      respondError(res, ctx, 400, "INVALID_MOVE_PAYLOAD", "Move payload is invalid", { gameId: moveGameId, guestId: actor.guestId });
      return;
    }

    try {
      const updated = store.submitMove(moveGameId, actor, body.move, body.expectedVersion);
      respond(res, ctx, 200, updated, { gameId: moveGameId, guestId: actor.guestId, event: "game.moved" });
      realtime.broadcast(moveGameId, "game.updated", updated);
      return;
    } catch (error) {
      const code = extractErrorCode(error);
      const meta = { gameId: moveGameId, guestId: actor.guestId };

      if (respondMappedError(res, ctx, code, MOVE_ERROR_RESPONSES, meta)) {
        return;
      }

      if (code.startsWith("ILLEGAL_MOVE:")) {
        respondError(res, ctx, 400, "ILLEGAL_MOVE", code, meta);
        return;
      }

      throw error;
    }
  }

  const resignGameId = matchGameId(req.url, ROUTE_RESIGN);
  if (req.method === "POST" && resignGameId) {
    const actor = authenticateActor(req, res, resignGameId, ctx);
    if (!actor) {
      return;
    }

    try {
      const updated = store.resign(resignGameId, actor);
      respond(res, ctx, 200, updated, { gameId: resignGameId, guestId: actor.guestId, event: "game.resigned" });
      realtime.broadcast(resignGameId, "game.finished", updated);
      return;
    } catch (error) {
      const code = extractErrorCode(error);
      if (respondMappedError(res, ctx, code, RESIGN_ERROR_RESPONSES, { gameId: resignGameId, guestId: actor.guestId })) {
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
