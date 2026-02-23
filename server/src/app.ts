import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readJsonBody, writeJson } from "./http";
import { InMemoryStore } from "./store";
import type { CreateGameInput } from "./types";

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

  writeJson(res, 404, { error: "Not Found" });
}

export function createApp() {
  return createServer((req, res) => {
    handleRequest(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      writeJson(res, 500, { error: message });
    });
  });
}
