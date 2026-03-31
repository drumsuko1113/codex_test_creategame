import type { Game, MoveRecord, Player } from "./types";
import type { GameRow, MoveRow, PersistedGame, PlayerRow } from "./storeTypes";
import { toIso, toNumber } from "./storeDbUtils";
import { projectClockForSnapshot } from "./storeClockLogic";
import { oppositeSeat } from "./storeSeatLogic";

export function toGame(snapshot: PersistedGame): Game {
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

export function toPersistedGame(game: Game, joinTokenHash = ""): PersistedGame {
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

export function toProjectedGame(snapshot: PersistedGame, nowMs: number): Game {
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

export function mapGameRow(row: GameRow): PersistedGame {
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

export function mapPlayerRow(row: PlayerRow): Player {
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

export function mapMoveRow(row: MoveRow): MoveRecord {
  return {
    ply: toNumber(row.ply),
    actorSeat: row.actor_seat,
    move: row.move_json,
    stateAfter: row.state_json_after,
    createdAt: toIso(row.created_at),
  };
}
