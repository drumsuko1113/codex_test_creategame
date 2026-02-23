import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Move } from "../../core/src/types";
import { readJsonBody, writeJson } from "./http";
import { log } from "./logger";
import { requireSessionAuth } from "./middleware";
import { InMemoryStore } from "./store";
import type { CreateGameInput, JoinGameInput } from "./types";

const store = new InMemoryStore();

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

  if (req.method === "GET" && req.url === "/health") {
    respond(res, ctx, 200, { ok: true }, { event: "health" });
    return;
  }

  if (req.method === "POST" && req.url === "/api/games") {
    const body = await readJsonBody<CreateGameInput>(req);
    if (!isValidCreateGameInput(body)) {
      respond(res, ctx, 400, { error: "Invalid create game payload" });
      return;
    }

    const created = store.createGame(body);
    respond(res, ctx, 201, created, { gameId: created.gameId, event: "game.created" });
    return;
  }

  const joinMatch = req.url?.match(/^\/api\/games\/([^/]+)\/join$/);
  if (req.method === "POST" && joinMatch) {
    const gameId = joinMatch[1];
    const body = await readJsonBody<JoinGameInput>(req);
    if (!isValidJoinGameInput(body)) {
      respond(res, ctx, 400, { error: "Invalid join payload" }, { gameId });
      return;
    }

    try {
      const joined = store.joinGame(gameId, body);
      respond(res, ctx, 200, joined, { gameId, guestId: joined.guestId, event: "game.joined" });
      return;
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";
      if (code === "GAME_NOT_FOUND") {
        respond(res, ctx, 404, { error: code }, { gameId });
        return;
      }
      if (code === "INVALID_JOIN_TOKEN") {
        respond(res, ctx, 401, { error: code }, { gameId });
        return;
      }
      if (code === "GAME_IS_FULL" || code === "SEAT_ALREADY_TAKEN") {
        respond(res, ctx, 409, { error: code }, { gameId });
        return;
      }
      throw error;
    }
  }

  const getGameMatch = req.url?.match(/^\/api\/games\/([^/]+)$/);
  if (req.method === "GET" && getGameMatch) {
    const gameId = getGameMatch[1];
    const game = store.getGame(gameId);
    if (!game) {
      respond(res, ctx, 404, { error: "GAME_NOT_FOUND" }, { gameId });
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
        respond(res, ctx, 401, { error: code }, { gameId });
        return;
      }
      throw error;
    }

    const body = await readJsonBody<unknown>(req);
    if (!isMoveRequestBody(body)) {
      respond(res, ctx, 400, { error: "INVALID_MOVE_PAYLOAD" }, { gameId, guestId: actor.guestId });
      return;
    }

    try {
      const updated = store.submitMove(gameId, actor, body.move, body.expectedVersion);
      respond(res, ctx, 200, updated, { gameId, guestId: actor.guestId, event: "game.moved" });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN";
      if (message === "GAME_NOT_FOUND") {
        respond(res, ctx, 404, { error: message }, { gameId, guestId: actor.guestId });
        return;
      }
      if (message === "GAME_NOT_ACTIVE" || message === "NOT_YOUR_TURN" || message === "VERSION_CONFLICT") {
        respond(res, ctx, 409, { error: message }, { gameId, guestId: actor.guestId });
        return;
      }
      if (message.startsWith("ILLEGAL_MOVE:")) {
        respond(res, ctx, 400, { error: message }, { gameId, guestId: actor.guestId });
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
        respond(res, ctx, 401, { error: code }, { gameId });
        return;
      }
      throw error;
    }

    try {
      const updated = store.resign(gameId, actor);
      respond(res, ctx, 200, updated, { gameId, guestId: actor.guestId, event: "game.resigned" });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN";
      if (message === "GAME_NOT_FOUND") {
        respond(res, ctx, 404, { error: message }, { gameId, guestId: actor.guestId });
        return;
      }
      if (message === "GAME_ALREADY_FINISHED") {
        respond(res, ctx, 409, { error: message }, { gameId, guestId: actor.guestId });
        return;
      }
      throw error;
    }
  }

  respond(res, ctx, 404, { error: "Not Found" });
}

export function createApp() {
  return createServer((req, res) => {
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
      respond(res, ctx, 500, { error: message });
    });
  });
}
