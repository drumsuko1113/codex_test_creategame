import { randomUUID } from "node:crypto";
import { createInitialGameState } from "../../core/src/initialPosition";
import type { CreateGameInput, Game } from "./types";

function toIsoNow(): string {
  return new Date().toISOString();
}

function createJoinToken(): string {
  return randomUUID().replaceAll("-", "");
}

export class InMemoryStore {
  private readonly games = new Map<string, Game>();
  private readonly joinTokens = new Map<string, string>();

  createGame(input: CreateGameInput): { gameId: string; joinToken: string } {
    const gameId = randomUUID();
    const now = toIsoNow();

    this.games.set(gameId, {
      id: gameId,
      status: "waiting",
      turn: "black",
      state: createInitialGameState(),
      mainSecondsBlack: input.mainMinutes * 60,
      mainSecondsWhite: input.mainMinutes * 60,
      byoSecondsBlack: input.byoSeconds,
      byoSecondsWhite: input.byoSeconds,
      resultType: null,
      winner: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const joinToken = createJoinToken();
    this.joinTokens.set(gameId, joinToken);
    return { gameId, joinToken };
  }
}
