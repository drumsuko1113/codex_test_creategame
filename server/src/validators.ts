import type { Move } from "../../core/src/types";
import type { CreateGameInput, JoinGameInput } from "./types";

export type MoveRequestBody = {
  move: Move;
  expectedVersion: number;
};

export function isValidCreateGameInput(input: CreateGameInput): boolean {
  if (!Number.isInteger(input.mainMinutes) || input.mainMinutes <= 0) {
    return false;
  }
  if (!Number.isInteger(input.byoSeconds) || input.byoSeconds < 0) {
    return false;
  }
  return input.byoSeconds === 0 || input.byoSeconds % 10 === 0;
}

export function isValidJoinGameInput(input: JoinGameInput): boolean {
  const trimmed = input.name?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
    return false;
  }
  if (input.seat !== "black" && input.seat !== "white") {
    return false;
  }
  return typeof input.joinToken === "string" && input.joinToken.length >= 16;
}

export function isMoveRequestBody(input: unknown): input is MoveRequestBody {
  if (!input || typeof input !== "object") {
    return false;
  }
  const body = input as Record<string, unknown>;
  return typeof body.expectedVersion === "number" && Number.isInteger(body.expectedVersion) && "move" in body;
}
