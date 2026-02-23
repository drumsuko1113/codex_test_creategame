import type { IncomingMessage } from "node:http";
import { hashToken } from "./auth";
import type { InMemoryStore } from "./store";
import type { Player } from "./types";

function readBearerToken(req: IncomingMessage): string | null {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return null;
  }

  const [type, token] = authorization.split(" ");
  if (type !== "Bearer" || !token) {
    return null;
  }
  return token;
}

export function requireSessionAuth(req: IncomingMessage, store: InMemoryStore, gameId: string): Player {
  const token = readBearerToken(req);
  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const player = store.findPlayerBySessionToken(gameId, hashToken(token));
  if (!player) {
    throw new Error("UNAUTHORIZED");
  }
  return player;
}
