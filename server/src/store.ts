import { randomUUID } from "node:crypto";
import type { Move } from "../../core/src/types";
import { applyMove } from "../../core/src/applyMove";
import { createInitialGameState } from "../../core/src/initialPosition";
import { createSessionToken, hashToken } from "./auth";
import type { CreateGameInput, Game, JoinGameInput, MoveRecord, Player, Seat } from "./types";

function toIsoNow(): string {
  return new Date().toISOString();
}

function createJoinToken(): string {
  return randomUUID().replaceAll("-", "");
}

function oppositeSeat(seat: Seat): Seat {
  return seat === "black" ? "white" : "black";
}

export class InMemoryStore {
  private readonly games = new Map<string, Game>();
  private readonly joinTokens = new Map<string, string>();
  private readonly playersByGame = new Map<string, Player[]>();
  private readonly movesByGame = new Map<string, MoveRecord[]>();

  private applyElapsedClock(game: Game, seat: Seat, nowMs: number): boolean {
    const elapsedSeconds = Math.ceil(Math.max(0, nowMs - game.turnStartedAtMs) / 1000);

    if (seat === "black") {
      if (elapsedSeconds <= game.mainSecondsBlack) {
        game.mainSecondsBlack -= elapsedSeconds;
        return false;
      }
      const overtime = elapsedSeconds - game.mainSecondsBlack;
      game.mainSecondsBlack = 0;
      return overtime > game.byoSecondsBlack;
    }

    if (elapsedSeconds <= game.mainSecondsWhite) {
      game.mainSecondsWhite -= elapsedSeconds;
      return false;
    }
    const overtime = elapsedSeconds - game.mainSecondsWhite;
    game.mainSecondsWhite = 0;
    return overtime > game.byoSecondsWhite;
  }

  private settleTimeoutIfNeeded(game: Game): void {
    if (game.status !== "active") {
      return;
    }

    const nowMs = Date.now();
    const timedOut = this.applyElapsedClock(game, game.turn, nowMs);
    if (!timedOut) {
      return;
    }

    game.status = "finished";
    game.resultType = "timeout";
    game.winner = oppositeSeat(game.turn);
    game.updatedAt = toIsoNow();
    game.version += 1;
  }

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
      turnStartedAtMs: Date.now(),
      createdAt: now,
      updatedAt: now,
    });

    const joinToken = createJoinToken();
    this.joinTokens.set(gameId, joinToken);
    this.playersByGame.set(gameId, []);
    this.movesByGame.set(gameId, []);
    return { gameId, joinToken };
  }

  joinGame(gameId: string, input: JoinGameInput): {
    guestId: string;
    sessionToken: string;
    seat: Seat;
  } {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error("GAME_NOT_FOUND");
    }

    const joinToken = this.joinTokens.get(gameId);
    if (!joinToken || joinToken !== input.joinToken) {
      throw new Error("INVALID_JOIN_TOKEN");
    }

    const players = this.playersByGame.get(gameId);
    if (!players) {
      throw new Error("GAME_NOT_FOUND");
    }

    if (players.length >= 2) {
      throw new Error("GAME_IS_FULL");
    }

    if (players.some((player) => player.seat === input.seat)) {
      throw new Error("SEAT_ALREADY_TAKEN");
    }

    const sessionToken = createSessionToken();
    const guestId = randomUUID();
    const player: Player = {
      id: randomUUID(),
      gameId,
      seat: input.seat,
      guestId,
      displayName: input.name.trim(),
      sessionTokenHash: hashToken(sessionToken),
      joinedAt: toIsoNow(),
    };

    players.push(player);
    game.status = players.length === 2 ? "active" : "waiting";
    if (game.status === "active") {
      game.turnStartedAtMs = Date.now();
    }
    game.updatedAt = toIsoNow();
    game.version += 1;

    return {
      guestId,
      sessionToken,
      seat: input.seat,
    };
  }

  findPlayerBySessionToken(gameId: string, tokenHash: string): Player | null {
    const players = this.playersByGame.get(gameId);
    if (!players) {
      return null;
    }
    return players.find((player) => player.sessionTokenHash === tokenHash) ?? null;
  }

  getGame(gameId: string): Game | null {
    const game = this.games.get(gameId) ?? null;
    if (!game) {
      return null;
    }
    this.settleTimeoutIfNeeded(game);
    return game;
  }

  submitMove(gameId: string, actor: Player, move: Move, expectedVersion: number): Game {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error("GAME_NOT_FOUND");
    }

    this.settleTimeoutIfNeeded(game);

    if (expectedVersion !== game.version) {
      throw new Error("VERSION_CONFLICT");
    }
    if (game.status !== "active") {
      throw new Error("GAME_NOT_ACTIVE");
    }
    if (actor.seat !== game.turn) {
      throw new Error("NOT_YOUR_TURN");
    }

    this.applyElapsedClock(game, actor.seat, Date.now());

    const result = applyMove(game.state, move);
    if (!result.ok) {
      throw new Error(`ILLEGAL_MOVE:${result.reason}`);
    }

    game.state = result.value;
    game.turn = result.value.turn;
    game.turnStartedAtMs = Date.now();
    game.updatedAt = toIsoNow();
    game.version += 1;

    const moves = this.movesByGame.get(gameId) ?? [];
    moves.push({
      ply: moves.length + 1,
      actorSeat: actor.seat,
      move,
      stateAfter: result.value,
      createdAt: toIsoNow(),
    });
    this.movesByGame.set(gameId, moves);

    return game;
  }

  resign(gameId: string, actor: Player): Game {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error("GAME_NOT_FOUND");
    }

    this.settleTimeoutIfNeeded(game);

    if (game.status === "finished") {
      throw new Error("GAME_ALREADY_FINISHED");
    }

    game.status = "finished";
    game.resultType = "resign";
    game.winner = oppositeSeat(actor.seat);
    game.updatedAt = toIsoNow();
    game.version += 1;
    return game;
  }

  getMoves(gameId: string): MoveRecord[] {
    return this.movesByGame.get(gameId) ?? [];
  }
}
