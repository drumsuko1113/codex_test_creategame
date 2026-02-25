import type { IncomingMessage } from "node:http";
import { hashToken } from "./auth";
import { verifyManagedAuthToken } from "./managedAuth";
import type { GameStore } from "./store";
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

export async function requireSessionAuth(req: IncomingMessage, store: GameStore, gameId: string): Promise<Player> {
  const token = readBearerToken(req);
  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const sessionPlayer = await store.findPlayerBySessionToken(gameId, hashToken(token));
  if (sessionPlayer) {
    return sessionPlayer;
  }

  const managed = verifyManagedAuthToken(token);
  const player = managed ? await store.findPlayerByGuestId(gameId, managed.subject) : null;
  if (!player) {
    throw new Error("UNAUTHORIZED");
  }
  return player;
}
