import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readJsonBody, writeJson } from "./http";
import { InMemoryStore } from "./store";
import type { CreateGameInput, JoinGameInput } from "./types";

const store = new InMemoryStore();

function isValidCreateGameInput(input: CreateGameInput): boolean {
  if (!Number.isInteger(input.mainMinutes) || input.mainMinutes <= 0) {
    return false;
  }
  if (!Number.isInteger(input.byoSeconds) || input.byoSeconds < 0) {
    return false;
  }
  return input.byoSeconds === 0 || input.byoSeconds % 10 === 0;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "GET" && req.url === "/health") {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && req.url === "/api/games") {
    const body = await readJsonBody<CreateGameInput>(req);
    if (!isValidCreateGameInput(body)) {
      writeJson(res, 400, { error: "Invalid create game payload" });
      return;
    }

    const created = store.createGame(body);
    writeJson(res, 201, created);
    return;
  }

  const joinMatch = req.url?.match(/^\/api\/games\/([^/]+)\/join$/);
  if (req.method === "POST" && joinMatch) {
    const body = await readJsonBody<JoinGameInput>(req);
    if (!isValidJoinGameInput(body)) {
      writeJson(res, 400, { error: "Invalid join payload" });
      return;
    }

    try {
      const joined = store.joinGame(joinMatch[1], body);
      writeJson(res, 200, joined);
      return;
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";
      if (code === "GAME_NOT_FOUND") {
        writeJson(res, 404, { error: code });
        return;
      }
      if (code === "INVALID_JOIN_TOKEN") {
        writeJson(res, 401, { error: code });
        return;
      }
      if (code === "GAME_IS_FULL" || code === "SEAT_ALREADY_TAKEN") {
        writeJson(res, 409, { error: code });
        return;
      }
      throw error;
    }
  }

  writeJson(res, 404, { error: "Not Found" });
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

export function createApp() {
  return createServer((req, res) => {
    handleRequest(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      writeJson(res, 500, { error: message });
    });
  });
}
