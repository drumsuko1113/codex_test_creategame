import type { GameState } from "../../core/src/types";

export type Seat = "black" | "white";
export type GameStatus = "waiting" | "active" | "finished";
export type ResultType = "checkmate" | "resign" | "timeout" | "repetition";

export type Game = {
  id: string;
  status: GameStatus;
  turn: Seat;
  state: GameState;
  mainSecondsBlack: number;
  mainSecondsWhite: number;
  byoSecondsBlack: number;
  byoSecondsWhite: number;
  resultType: ResultType | null;
  winner: Seat | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type Player = {
  id: string;
  gameId: string;
  seat: Seat;
  guestId: string;
  displayName: string;
  sessionTokenHash: string;
  joinedAt: string;
};

export type CreateGameInput = {
  mainMinutes: number;
  byoSeconds: number;
};
