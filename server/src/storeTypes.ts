import type { GameState, Move } from "../../core/src/types";
import type { Game, MoveRecord, Player, Seat } from "./types";

export type DbQueryResult<T> = {
  rows: T[];
  rowCount: number | null;
};

export type Queryable = {
  query<T extends Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<DbQueryResult<T>>;
};

export type TransactionClient = Queryable & {
  release: () => void;
};

export type PoolLike = Queryable & {
  connect: () => Promise<TransactionClient>;
  end?: () => Promise<void>;
};

export type PersistedGame = {
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

export type GameRow = {
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

export type PlayerRow = {
  id: string;
  game_id: string;
  seat: Seat;
  guest_id: string;
  display_name: string;
  session_token_hash: string;
  joined_at: string | Date;
};

export type MoveRow = {
  ply: number | string;
  actor_seat: Seat;
  move_json: Move;
  state_json_after: GameState;
  created_at: string | Date;
};

export type LastPlyRow = {
  ply: number | string;
};
