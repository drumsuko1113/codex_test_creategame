import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { Move, GameState } from "../../core/src/types";
import { applyMove } from "../../core/src/applyMove";
import { createInitialGameState } from "../../core/src/initialPosition";
import { createSessionToken, hashToken } from "./auth";
import { issueManagedAuthToken } from "./managedAuth";
import type { CreateGameInput, Game, JoinGameInput, LobbyMatchInput, LobbyMatchResult, MoveRecord, Player, Seat } from "./types";

type DbQueryResult<T> = {
  rows: T[];
  rowCount: number | null;
};

type Queryable = {
  query<T extends Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<DbQueryResult<T>>;
};

type TransactionClient = Queryable & {
  release: () => void;
};

type PoolLike = Queryable & {
  connect: () => Promise<TransactionClient>;
  end?: () => Promise<void>;
};

type PersistedGame = {
  id: string;
  status: Game["status"];
  turn: Seat;
  state: GameState;
  mainSecondsBlack: number;
  mainSecondsWhite: number;
  byoSecondsBlack: number;
  byoSecondsWhite: number;
  resultType: Game["resultType"] | null;
  winner: Seat | null;
  version: number;
  turnStartedAtMs: number;
  createdAt: string;
  updatedAt: string;
  joinTokenHash: string;
};

type GameRow = {
  id: string;
  status: Game["status"];
  turn: Seat;
  state_json: GameState;
  main_seconds_black: number | string;
  main_seconds_white: number | string;
  byo_seconds_black: number | string;
  byo_seconds_white: number | string;
  result_type: Game["resultType"] | null;
  winner: Seat | null;
  version: number | string;
  turn_started_at_ms: number | string | null;
  created_at: string | Date;
  updated_at: string | Date;
  join_token_hash: string;
};

type PlayerRow = {
  id: string;
  game_id: string;
  seat: Seat;
  guest_id: string;
  display_name: string;
  session_token_hash: string;
  joined_at: string | Date;
};

type MoveRow = {
  ply: number | string;
  actor_seat: Seat;
  move_json: Move;
  state_json_after: GameState;
  created_at: string | Date;
};

type LastPlyRow = {
  ply: number | string;
};

export interface GameStore {
  createGame(input: CreateGameInput): Promise<{ gameId: string; joinToken: string }>;
  joinGame(gameId: string, input: JoinGameInput): Promise<{
    guestId: string;
    sessionToken: string;
    managedToken: string | null;
    seat: Seat;
  }>;
  matchByPassphrase(input: LobbyMatchInput): Promise<LobbyMatchResult>;
  findPlayerBySessionToken(gameId: string, tokenHash: string): Promise<Player | null>;
  findPlayerByGuestId(gameId: string, guestId: string): Promise<Player | null>;
  getGame(gameId: string): Promise<Game | null>;
  submitMove(gameId: string, actor: Player, move: Move, expectedVersion: number): Promise<Game>;
  resign(gameId: string, actor: Player): Promise<Game>;
  getMoves(gameId: string): Promise<MoveRecord[]>;
  close?(): Promise<void>;
}

const DEFAULT_MATCH_MAIN_MINUTES = 10;
const DEFAULT_MATCH_BYO_SECONDS = 30;

function toIsoNow(): string {
  return new Date().toISOString();
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string | bigint | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function splitSqlStatements(script: string): string[] {
  return script
    .split(/;\s*(?:\r?\n|$)/g)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function createJoinToken(): string {
  return randomUUID().replaceAll("-", "");
}

function pickAvailableSeat(seats: readonly Seat[]): Seat | null {
  if (!seats.includes("black")) {
    return "black";
  }
  if (!seats.includes("white")) {
    return "white";
  }
  return null;
}

function pickRandomSeat(): Seat {
  return Math.random() < 0.5 ? "black" : "white";
}

function pickLobbySeat(seats: readonly Seat[]): Seat | null {
  if (seats.length === 0) {
    return pickRandomSeat();
  }
  return pickAvailableSeat(seats);
}

function oppositeSeat(seat: Seat): Seat {
  return seat === "black" ? "white" : "black";
}

type TurnClockProjection = {
  remainingMainSeconds: number;
  remainingByoSeconds: number;
  timedOut: boolean;
};

type SnapshotClockProjection = {
  mainSecondsBlack: number;
  mainSecondsWhite: number;
  byoSecondsBlack: number;
  byoSecondsWhite: number;
  turnStartedAtMs: number;
  timedOut: boolean;
};

function getElapsedWholeSeconds(turnStartedAtMs: number, nowMs: number): number {
  return Math.floor(Math.max(0, nowMs - turnStartedAtMs) / 1000);
}

function projectTurnClock(mainSeconds: number, byoSeconds: number, elapsedSeconds: number): TurnClockProjection {
  if (elapsedSeconds <= 0) {
    return {
      remainingMainSeconds: mainSeconds,
      remainingByoSeconds: byoSeconds,
      timedOut: false,
    };
  }

  if (elapsedSeconds <= mainSeconds) {
    return {
      remainingMainSeconds: mainSeconds - elapsedSeconds,
      remainingByoSeconds: byoSeconds,
      timedOut: false,
    };
  }

  const overtime = elapsedSeconds - mainSeconds;
  return {
    remainingMainSeconds: 0,
    remainingByoSeconds: Math.max(0, byoSeconds - overtime),
    timedOut: overtime > byoSeconds,
  };
}

function projectClockForSnapshot(game: PersistedGame, nowMs: number): SnapshotClockProjection {
  const base: SnapshotClockProjection = {
    mainSecondsBlack: game.mainSecondsBlack,
    mainSecondsWhite: game.mainSecondsWhite,
    byoSecondsBlack: game.byoSecondsBlack,
    byoSecondsWhite: game.byoSecondsWhite,
    turnStartedAtMs: game.turnStartedAtMs,
    timedOut: false,
  };

  if (game.status !== "active") {
    return base;
  }

  const elapsedSeconds = getElapsedWholeSeconds(game.turnStartedAtMs, nowMs);
  if (elapsedSeconds <= 0) {
    return base;
  }

  if (game.turn === "black") {
    const projected = projectTurnClock(game.mainSecondsBlack, game.byoSecondsBlack, elapsedSeconds);
    return {
      ...base,
      mainSecondsBlack: projected.remainingMainSeconds,
      byoSecondsBlack: projected.remainingByoSeconds,
      turnStartedAtMs: game.turnStartedAtMs + elapsedSeconds * 1000,
      timedOut: projected.timedOut,
    };
  }

  const projected = projectTurnClock(game.mainSecondsWhite, game.byoSecondsWhite, elapsedSeconds);
  return {
    ...base,
    mainSecondsWhite: projected.remainingMainSeconds,
    byoSecondsWhite: projected.remainingByoSeconds,
    turnStartedAtMs: game.turnStartedAtMs + elapsedSeconds * 1000,
    timedOut: projected.timedOut,
  };
}

function consumeElapsedClock(game: PersistedGame, nowMs: number): boolean {
  if (game.status !== "active") {
    return false;
  }

  const elapsedSeconds = getElapsedWholeSeconds(game.turnStartedAtMs, nowMs);
  if (elapsedSeconds <= 0) {
    return false;
  }

  if (game.turn === "black") {
    const projected = projectTurnClock(game.mainSecondsBlack, game.byoSecondsBlack, elapsedSeconds);
    game.mainSecondsBlack = projected.remainingMainSeconds;
    game.turnStartedAtMs += elapsedSeconds * 1000;
    if (!projected.timedOut) {
      return false;
    }
  } else {
    const projected = projectTurnClock(game.mainSecondsWhite, game.byoSecondsWhite, elapsedSeconds);
    game.mainSecondsWhite = projected.remainingMainSeconds;
    game.turnStartedAtMs += elapsedSeconds * 1000;
    if (!projected.timedOut) {
      return false;
    }
  }

  game.status = "finished";
  game.resultType = "timeout";
  game.winner = oppositeSeat(game.turn);
  game.updatedAt = new Date(nowMs).toISOString();
  game.version += 1;
  return true;
}

function settleTimeoutIfNeeded(game: PersistedGame, nowMs: number): boolean {
  const projected = projectClockForSnapshot(game, nowMs);
  if (!projected.timedOut) {
    return false;
  }

  game.mainSecondsBlack = projected.mainSecondsBlack;
  game.mainSecondsWhite = projected.mainSecondsWhite;
  game.turnStartedAtMs = projected.turnStartedAtMs;
  game.status = "finished";
  game.resultType = "timeout";
  game.winner = oppositeSeat(game.turn);
  game.updatedAt = new Date(nowMs).toISOString();
  game.version += 1;
  return true;
}

function toGame(snapshot: PersistedGame): Game {
  return {
    id: snapshot.id,
    status: snapshot.status,
    turn: snapshot.turn,
    state: snapshot.state,
    mainSecondsBlack: snapshot.mainSecondsBlack,
    mainSecondsWhite: snapshot.mainSecondsWhite,
    byoSecondsBlack: snapshot.byoSecondsBlack,
    byoSecondsWhite: snapshot.byoSecondsWhite,
    resultType: snapshot.resultType,
    winner: snapshot.winner,
    version: snapshot.version,
    turnStartedAtMs: snapshot.turnStartedAtMs,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toPersistedGame(game: Game, joinTokenHash = ""): PersistedGame {
  return {
    id: game.id,
    status: game.status,
    turn: game.turn,
    state: game.state,
    mainSecondsBlack: game.mainSecondsBlack,
    mainSecondsWhite: game.mainSecondsWhite,
    byoSecondsBlack: game.byoSecondsBlack,
    byoSecondsWhite: game.byoSecondsWhite,
    resultType: game.resultType,
    winner: game.winner,
    version: game.version,
    turnStartedAtMs: game.turnStartedAtMs,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    joinTokenHash,
  };
}

function toProjectedGame(snapshot: PersistedGame, nowMs: number): Game {
  if (snapshot.status !== "active") {
    return toGame(snapshot);
  }

  const projected = projectClockForSnapshot(snapshot, nowMs);
  if (projected.timedOut) {
    return {
      ...toGame(snapshot),
      mainSecondsBlack: projected.mainSecondsBlack,
      mainSecondsWhite: projected.mainSecondsWhite,
      byoSecondsBlack: projected.byoSecondsBlack,
      byoSecondsWhite: projected.byoSecondsWhite,
      turnStartedAtMs: projected.turnStartedAtMs,
      status: "finished",
      resultType: "timeout",
      winner: oppositeSeat(snapshot.turn),
      version: snapshot.version + 1,
      updatedAt: new Date(nowMs).toISOString(),
    };
  }

  return {
    ...toGame(snapshot),
    mainSecondsBlack: projected.mainSecondsBlack,
    mainSecondsWhite: projected.mainSecondsWhite,
    byoSecondsBlack: projected.byoSecondsBlack,
    byoSecondsWhite: projected.byoSecondsWhite,
    turnStartedAtMs: projected.turnStartedAtMs,
  };
}

function mapGameRow(row: GameRow): PersistedGame {
  const updatedAt = toIso(row.updated_at);
  const persistedTurnStartedAtMs = toNumber(row.turn_started_at_ms);
  const fallbackTurnStartedAtMs = new Date(updatedAt).getTime();

  return {
    id: row.id,
    status: row.status,
    turn: row.turn,
    state: row.state_json,
    mainSecondsBlack: toNumber(row.main_seconds_black),
    mainSecondsWhite: toNumber(row.main_seconds_white),
    byoSecondsBlack: toNumber(row.byo_seconds_black),
    byoSecondsWhite: toNumber(row.byo_seconds_white),
    resultType: row.result_type,
    winner: row.winner,
    version: toNumber(row.version),
    turnStartedAtMs: persistedTurnStartedAtMs > 0 ? persistedTurnStartedAtMs : fallbackTurnStartedAtMs,
    createdAt: toIso(row.created_at),
    updatedAt,
    joinTokenHash: row.join_token_hash,
  };
}

function mapPlayerRow(row: PlayerRow): Player {
  return {
    id: row.id,
    gameId: row.game_id,
    seat: row.seat,
    guestId: row.guest_id,
    displayName: row.display_name,
    sessionTokenHash: row.session_token_hash,
    joinedAt: toIso(row.joined_at),
  };
}

function mapMoveRow(row: MoveRow): MoveRecord {
  return {
    ply: toNumber(row.ply),
    actorSeat: row.actor_seat,
    move: row.move_json,
    stateAfter: row.state_json_after,
    createdAt: toIso(row.created_at),
  };
}

let migrationScriptsPromise: Promise<string[]> | null = null;

async function loadMigrationScripts(): Promise<string[]> {
  const migrationDir = fileURLToPath(new URL("../db/migrations", import.meta.url));
  const files = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
  return Promise.all(files.map((file) => readFile(path.join(migrationDir, file), "utf8")));
}

async function getMigrationScripts(): Promise<string[]> {
  if (!migrationScriptsPromise) {
    migrationScriptsPromise = loadMigrationScripts();
  }
  return migrationScriptsPromise;
}

export class InMemoryStore implements GameStore {
  private readonly games = new Map<string, Game>();
  private readonly joinTokens = new Map<string, string>();
  private readonly playersByGame = new Map<string, Player[]>();
  private readonly movesByGame = new Map<string, MoveRecord[]>();
  private readonly passphrasesByGame = new Map<string, string>();

  private settleTimeoutIfNeeded(game: Game, nowMs: number): void {
    const snapshot = toPersistedGame(game);
    const changed = settleTimeoutIfNeeded(snapshot, nowMs);
    if (!changed) {
      return;
    }

    game.mainSecondsBlack = snapshot.mainSecondsBlack;
    game.mainSecondsWhite = snapshot.mainSecondsWhite;
    game.turnStartedAtMs = snapshot.turnStartedAtMs;
    game.status = snapshot.status;
    game.resultType = snapshot.resultType;
    game.winner = snapshot.winner;
    game.updatedAt = snapshot.updatedAt;
    game.version = snapshot.version;
  }

  private consumeElapsedClockProgress(game: Game, nowMs: number): void {
    const snapshot = toPersistedGame(game);
    consumeElapsedClock(snapshot, nowMs);

    game.mainSecondsBlack = snapshot.mainSecondsBlack;
    game.mainSecondsWhite = snapshot.mainSecondsWhite;
    game.turnStartedAtMs = snapshot.turnStartedAtMs;
    if (snapshot.status === "finished") {
      game.status = snapshot.status;
      game.resultType = snapshot.resultType;
      game.winner = snapshot.winner;
      game.updatedAt = snapshot.updatedAt;
      game.version = snapshot.version;
    }
  }

  async createGame(input: CreateGameInput): Promise<{ gameId: string; joinToken: string }> {
    const gameId = randomUUID();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

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
      turnStartedAtMs: nowMs,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const joinToken = createJoinToken();
    this.joinTokens.set(gameId, joinToken);
    this.playersByGame.set(gameId, []);
    this.movesByGame.set(gameId, []);

    return { gameId, joinToken };
  }

  async joinGame(gameId: string, input: JoinGameInput): Promise<{
    guestId: string;
    sessionToken: string;
    managedToken: string | null;
    seat: Seat;
  }> {
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

    players.push({
      id: randomUUID(),
      gameId,
      seat: input.seat,
      guestId,
      displayName: input.name.trim(),
      sessionTokenHash: hashToken(sessionToken),
      joinedAt: toIsoNow(),
    });

    game.status = players.length === 2 ? "active" : "waiting";
    if (game.status === "active") {
      game.turnStartedAtMs = Date.now();
    }
    game.updatedAt = toIsoNow();
    game.version += 1;

    return {
      guestId,
      sessionToken,
      managedToken: issueManagedAuthToken(guestId),
      seat: input.seat,
    };
  }

  async matchByPassphrase(input: LobbyMatchInput): Promise<LobbyMatchResult> {
    const passphrase = input.passphrase.trim();
    const normalizedName = input.name.trim();

    let targetGameId: string | null = null;
    for (const [gameId, gamePassphrase] of this.passphrasesByGame.entries()) {
      const game = this.games.get(gameId);
      if (!game || game.status !== "waiting" || gamePassphrase !== passphrase) {
        continue;
      }
      targetGameId = gameId;
      break;
    }

    if (!targetGameId) {
      const created = await this.createGame({
        mainMinutes: DEFAULT_MATCH_MAIN_MINUTES,
        byoSeconds: DEFAULT_MATCH_BYO_SECONDS,
      });
      targetGameId = created.gameId;
      this.passphrasesByGame.set(targetGameId, passphrase);
    }

    const players = this.playersByGame.get(targetGameId);
    const seat = pickLobbySeat(players?.map((player) => player.seat) ?? []);
    if (!seat) {
      const created = await this.createGame({
        mainMinutes: DEFAULT_MATCH_MAIN_MINUTES,
        byoSeconds: DEFAULT_MATCH_BYO_SECONDS,
      });
      targetGameId = created.gameId;
      this.passphrasesByGame.set(targetGameId, passphrase);
    }

    if (!targetGameId) {
      throw new Error("GAME_NOT_FOUND");
    }

    const targetJoinToken = this.joinTokens.get(targetGameId);
    if (!targetJoinToken) {
      throw new Error("GAME_NOT_FOUND");
    }

    const reloadedPlayers = this.playersByGame.get(targetGameId) ?? [];
    const resolvedSeat = pickLobbySeat(reloadedPlayers.map((player) => player.seat));
    if (!resolvedSeat) {
      throw new Error("GAME_IS_FULL");
    }

    const joined = await this.joinGame(targetGameId, {
      name: normalizedName,
      seat: resolvedSeat,
      joinToken: targetJoinToken,
    });

    return {
      gameId: targetGameId,
      guestId: joined.guestId,
      sessionToken: joined.sessionToken,
      managedToken: joined.managedToken,
      seat: joined.seat,
    };
  }

  async findPlayerBySessionToken(gameId: string, tokenHash: string): Promise<Player | null> {
    const players = this.playersByGame.get(gameId);
    if (!players) {
      return null;
    }
    return players.find((player) => player.sessionTokenHash === tokenHash) ?? null;
  }

  async findPlayerByGuestId(gameId: string, guestId: string): Promise<Player | null> {
    const players = this.playersByGame.get(gameId);
    if (!players) {
      return null;
    }
    return players.find((player) => player.guestId === guestId) ?? null;
  }

  async getGame(gameId: string): Promise<Game | null> {
    const game = this.games.get(gameId) ?? null;
    if (!game) {
      return null;
    }
    const nowMs = Date.now();
    this.settleTimeoutIfNeeded(game, nowMs);
    return toProjectedGame(toPersistedGame(game), nowMs);
  }

  async submitMove(gameId: string, actor: Player, move: Move, expectedVersion: number): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error("GAME_NOT_FOUND");
    }

    this.consumeElapsedClockProgress(game, Date.now());

    if (expectedVersion !== game.version) {
      throw new Error("VERSION_CONFLICT");
    }
    if (game.status !== "active") {
      throw new Error("GAME_NOT_ACTIVE");
    }
    if (actor.seat !== game.turn) {
      throw new Error("NOT_YOUR_TURN");
    }

    const result = applyMove(game.state, move);
    if (!result.ok) {
      throw new Error(`ILLEGAL_MOVE:${result.reason}`);
    }

    game.state = result.value;
    game.turn = result.value.turn;
    game.turnStartedAtMs = Date.now();
    game.updatedAt = toIsoNow();
    game.version += 1;

    const moves = this.movesByGame.get(gameId);
    if (!moves) {
      throw new Error("GAME_NOT_FOUND");
    }

    moves.push({
      ply: moves.length + 1,
      actorSeat: actor.seat,
      move,
      stateAfter: result.value,
      createdAt: toIsoNow(),
    });

    return game;
  }

  async resign(gameId: string, actor: Player): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error("GAME_NOT_FOUND");
    }

    this.consumeElapsedClockProgress(game, Date.now());

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

  async getMoves(gameId: string): Promise<MoveRecord[]> {
    return this.movesByGame.get(gameId) ?? [];
  }
}

export class PostgresStore implements GameStore {
  private initPromise: Promise<void> | null = null;

  constructor(private readonly pool: PoolLike) {}

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.runMigrations().catch((error: unknown) => {
        this.initPromise = null;
        throw error;
      });
    }
    await this.initPromise;
  }

  private async runMigrations(): Promise<void> {
    const scripts = await getMigrationScripts();
    for (const script of scripts) {
      const statements = splitSqlStatements(script);
      for (const statement of statements) {
        await this.pool.query(statement);
      }
    }
  }

  private async withTransaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback errors and preserve the original error.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async lockGame(client: Queryable, gameId: string): Promise<PersistedGame | null> {
    const result = await client.query<GameRow>(
      `SELECT
         id,
         status,
         turn,
         state_json,
         main_seconds_black,
         main_seconds_white,
         byo_seconds_black,
         byo_seconds_white,
         result_type,
         winner,
         version,
         turn_started_at_ms,
         created_at,
         updated_at,
         join_token_hash
       FROM games
       WHERE id = $1
       FOR UPDATE`,
      [gameId],
    );

    if (!result.rowCount) {
      return null;
    }

    return mapGameRow(result.rows[0]);
  }

  private async lockWaitingGameByPassphrase(client: Queryable, passphraseHash: string): Promise<PersistedGame | null> {
    const result = await client.query<GameRow>(
      `SELECT
         id,
         status,
         turn,
         state_json,
         main_seconds_black,
         main_seconds_white,
         byo_seconds_black,
         byo_seconds_white,
         result_type,
         winner,
         version,
         turn_started_at_ms,
         created_at,
         updated_at,
         join_token_hash
       FROM games
       WHERE status = 'waiting' AND join_token_hash = $1
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE`,
      [passphraseHash],
    );

    if (!result.rowCount) {
      return null;
    }

    return mapGameRow(result.rows[0]);
  }

  private async createMatchGame(client: Queryable, passphraseHash: string): Promise<PersistedGame> {
    const gameId = randomUUID();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const mainSeconds = DEFAULT_MATCH_MAIN_MINUTES * 60;

    await client.query(
      `INSERT INTO games (
         id,
         status,
         turn,
         state_json,
         main_seconds_black,
         main_seconds_white,
         byo_seconds_black,
         byo_seconds_white,
         result_type,
         winner,
         version,
         join_token_hash,
         turn_started_at_ms,
         created_at,
         updated_at
       ) VALUES (
         $1, 'waiting', 'black', $2::jsonb, $3, $3, $4, $4, NULL, NULL, 1, $5, $6, $7, $7
       )`,
      [
        gameId,
        JSON.stringify(createInitialGameState()),
        mainSeconds,
        DEFAULT_MATCH_BYO_SECONDS,
        passphraseHash,
        nowMs,
        nowIso,
      ],
    );

    return {
      id: gameId,
      status: "waiting",
      turn: "black",
      state: createInitialGameState(),
      mainSecondsBlack: mainSeconds,
      mainSecondsWhite: mainSeconds,
      byoSecondsBlack: DEFAULT_MATCH_BYO_SECONDS,
      byoSecondsWhite: DEFAULT_MATCH_BYO_SECONDS,
      resultType: null,
      winner: null,
      version: 1,
      turnStartedAtMs: nowMs,
      createdAt: nowIso,
      updatedAt: nowIso,
      joinTokenHash: passphraseHash,
    };
  }

  private async updateGame(client: Queryable, game: PersistedGame, previousVersion: number): Promise<void> {
    const result = await client.query(
      `UPDATE games
       SET
         status = $2,
         turn = $3,
         state_json = $4::jsonb,
         main_seconds_black = $5,
         main_seconds_white = $6,
         byo_seconds_black = $7,
         byo_seconds_white = $8,
         result_type = $9,
         winner = $10,
         version = $11,
         turn_started_at_ms = $12,
         updated_at = $13
       WHERE id = $1 AND version = $14`,
      [
        game.id,
        game.status,
        game.turn,
        JSON.stringify(game.state),
        game.mainSecondsBlack,
        game.mainSecondsWhite,
        game.byoSecondsBlack,
        game.byoSecondsWhite,
        game.resultType,
        game.winner,
        game.version,
        game.turnStartedAtMs,
        game.updatedAt,
        previousVersion,
      ],
    );

    if (!result.rowCount) {
      throw new Error("VERSION_CONFLICT");
    }
  }

  async createGame(input: CreateGameInput): Promise<{ gameId: string; joinToken: string }> {
    await this.ensureInitialized();
    const gameId = randomUUID();
    const joinToken = createJoinToken();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    await this.pool.query(
      `INSERT INTO games (
         id,
         status,
         turn,
         state_json,
         main_seconds_black,
         main_seconds_white,
         byo_seconds_black,
         byo_seconds_white,
         result_type,
         winner,
         version,
         join_token_hash,
         turn_started_at_ms,
         created_at,
         updated_at
       ) VALUES (
         $1, 'waiting', 'black', $2::jsonb, $3, $3, $4, $4, NULL, NULL, 1, $5, $6, $7, $7
       )`,
      [
        gameId,
        JSON.stringify(createInitialGameState()),
        input.mainMinutes * 60,
        input.byoSeconds,
        hashToken(joinToken),
        nowMs,
        nowIso,
      ],
    );

    return { gameId, joinToken };
  }

  async joinGame(gameId: string, input: JoinGameInput): Promise<{
    guestId: string;
    sessionToken: string;
    managedToken: string | null;
    seat: Seat;
  }> {
    return this.withTransaction(async (client) => {
      const game = await this.lockGame(client, gameId);
      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      if (game.joinTokenHash !== hashToken(input.joinToken)) {
        throw new Error("INVALID_JOIN_TOKEN");
      }

      const playersResult = await client.query<{ seat: Seat }>(
        `SELECT seat
         FROM game_players
         WHERE game_id = $1
         FOR UPDATE`,
        [gameId],
      );

      const seats = playersResult.rows.map((row) => row.seat);
      if (seats.length >= 2) {
        throw new Error("GAME_IS_FULL");
      }
      if (seats.includes(input.seat)) {
        throw new Error("SEAT_ALREADY_TAKEN");
      }

      const sessionToken = createSessionToken();
      const guestId = randomUUID();
      const joinedAt = toIsoNow();

      await client.query(
        `INSERT INTO game_players (
           id,
           game_id,
           seat,
           guest_id,
           display_name,
           session_token_hash,
           joined_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), gameId, input.seat, guestId, input.name.trim(), hashToken(sessionToken), joinedAt],
      );

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      game.status = seats.length + 1 === 2 ? "active" : "waiting";
      game.updatedAt = nowIso;
      game.version += 1;
      if (game.status === "active") {
        game.turnStartedAtMs = nowMs;
      }

      await this.updateGame(client, game, game.version - 1);

      return {
        guestId,
        sessionToken,
        managedToken: issueManagedAuthToken(guestId),
        seat: input.seat,
      };
    });
  }

  async matchByPassphrase(input: LobbyMatchInput): Promise<LobbyMatchResult> {
    const passphraseHash = hashToken(input.passphrase.trim());
    const normalizedName = input.name.trim();

    return this.withTransaction(async (client) => {
      let game = await this.lockWaitingGameByPassphrase(client, passphraseHash);
      if (!game) {
        game = await this.createMatchGame(client, passphraseHash);
      }

      let playersResult = await client.query<{ seat: Seat }>(
        `SELECT seat
         FROM game_players
         WHERE game_id = $1
         FOR UPDATE`,
        [game.id],
      );

      let seat = pickLobbySeat(playersResult.rows.map((row) => row.seat));
      if (!seat) {
        game = await this.createMatchGame(client, passphraseHash);
        playersResult = { rows: [], rowCount: 0 };
        seat = pickLobbySeat([]);
      }
      if (!seat) {
        throw new Error("GAME_IS_FULL");
      }

      const sessionToken = createSessionToken();
      const guestId = randomUUID();
      const joinedAt = toIsoNow();

      await client.query(
        `INSERT INTO game_players (
           id,
           game_id,
           seat,
           guest_id,
           display_name,
           session_token_hash,
           joined_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), game.id, seat, guestId, normalizedName, hashToken(sessionToken), joinedAt],
      );

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      game.status = playersResult.rows.length + 1 === 2 ? "active" : "waiting";
      game.updatedAt = nowIso;
      game.version += 1;
      if (game.status === "active") {
        game.turnStartedAtMs = nowMs;
      }

      await this.updateGame(client, game, game.version - 1);

      return {
        gameId: game.id,
        guestId,
        sessionToken,
        managedToken: issueManagedAuthToken(guestId),
        seat,
      };
    });
  }

  async findPlayerBySessionToken(gameId: string, tokenHash: string): Promise<Player | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<PlayerRow>(
      `SELECT
         id,
         game_id,
         seat,
         guest_id,
         display_name,
         session_token_hash,
         joined_at
       FROM game_players
       WHERE game_id = $1 AND session_token_hash = $2
       LIMIT 1`,
      [gameId, tokenHash],
    );
    if (!result.rowCount) {
      return null;
    }
    return mapPlayerRow(result.rows[0]);
  }

  async findPlayerByGuestId(gameId: string, guestId: string): Promise<Player | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<PlayerRow>(
      `SELECT
         id,
         game_id,
         seat,
         guest_id,
         display_name,
         session_token_hash,
         joined_at
       FROM game_players
       WHERE game_id = $1 AND guest_id = $2
       LIMIT 1`,
      [gameId, guestId],
    );
    if (!result.rowCount) {
      return null;
    }
    return mapPlayerRow(result.rows[0]);
  }

  async getGame(gameId: string): Promise<Game | null> {
    return this.withTransaction(async (client) => {
      const game = await this.lockGame(client, gameId);
      if (!game) {
        return null;
      }

      const nowMs = Date.now();
      const timedOut = settleTimeoutIfNeeded(game, nowMs);
      if (timedOut) {
        await this.updateGame(client, game, game.version - 1);
        return toGame(game);
      }

      return toProjectedGame(game, nowMs);
    });
  }

  async submitMove(gameId: string, actor: Player, move: Move, expectedVersion: number): Promise<Game> {
    return this.withTransaction(async (client) => {
      const game = await this.lockGame(client, gameId);
      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      consumeElapsedClock(game, Date.now());
      const timedOut = game.status === "finished" && game.resultType === "timeout";
      if (timedOut) {
        await this.updateGame(client, game, game.version - 1);
      }

      if (expectedVersion !== game.version) {
        throw new Error("VERSION_CONFLICT");
      }
      if (game.status !== "active") {
        throw new Error("GAME_NOT_ACTIVE");
      }
      if (actor.seat !== game.turn) {
        throw new Error("NOT_YOUR_TURN");
      }

      const result = applyMove(game.state, move);
      if (!result.ok) {
        throw new Error(`ILLEGAL_MOVE:${result.reason}`);
      }

      const previousVersion = game.version;
      game.state = result.value;
      game.turn = result.value.turn;
      game.turnStartedAtMs = Date.now();
      game.updatedAt = toIsoNow();
      game.version += 1;

      await this.updateGame(client, game, previousVersion);

      const lastMoveResult = await client.query<LastPlyRow>(
        `SELECT ply
         FROM moves
         WHERE game_id = $1
         ORDER BY ply DESC
         LIMIT 1`,
        [gameId],
      );
      const nextPly = toNumber(lastMoveResult.rows[0]?.ply) + 1;

      await client.query(
        `INSERT INTO moves (
           game_id,
           ply,
           actor_seat,
           move_json,
           state_json_after,
           created_at
         ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [gameId, nextPly, actor.seat, JSON.stringify(move), JSON.stringify(result.value), toIsoNow()],
      );

      return toGame(game);
    });
  }

  async resign(gameId: string, actor: Player): Promise<Game> {
    return this.withTransaction(async (client) => {
      const game = await this.lockGame(client, gameId);
      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }

      consumeElapsedClock(game, Date.now());
      const timedOut = game.status === "finished" && game.resultType === "timeout";
      if (timedOut) {
        await this.updateGame(client, game, game.version - 1);
      }

      if (game.status === "finished") {
        throw new Error("GAME_ALREADY_FINISHED");
      }

      const previousVersion = game.version;
      game.status = "finished";
      game.resultType = "resign";
      game.winner = oppositeSeat(actor.seat);
      game.updatedAt = toIsoNow();
      game.version += 1;

      await this.updateGame(client, game, previousVersion);
      return toGame(game);
    });
  }

  async getMoves(gameId: string): Promise<MoveRecord[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<MoveRow>(
      `SELECT
         ply,
         actor_seat,
         move_json,
         state_json_after,
         created_at
       FROM moves
       WHERE game_id = $1
       ORDER BY ply ASC`,
      [gameId],
    );

    return result.rows.map(mapMoveRow);
  }

  async close(): Promise<void> {
    if (this.pool.end) {
      await this.pool.end();
    }
  }
}

export function createDefaultStore(): GameStore {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return new InMemoryStore();
  }

  return new PostgresStore(new Pool({ connectionString: databaseUrl }));
}
