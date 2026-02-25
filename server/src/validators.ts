import type { Move } from "../../core/src/types";
import type { CreateGameInput, JoinGameInput } from "./types";

export type MoveRequestBody = {
  move: Move;
  expectedVersion: number;
};

type JsonRecord = Record<string, unknown>;

const DROP_KINDS = new Set(["rook", "bishop", "gold", "silver", "knight", "lance", "pawn"]);

function isRecord(input: unknown): input is JsonRecord {
  return !!input && typeof input === "object";
}

function isPosition(input: unknown): input is { x: number; y: number } {
  if (!isRecord(input)) {
    return false;
  }
  return (
    Number.isInteger(input.x) &&
    Number.isInteger(input.y) &&
    (input.x as number) >= 0 &&
    (input.x as number) <= 8 &&
    (input.y as number) >= 0 &&
    (input.y as number) <= 8
  );
}

function isMoveShape(input: unknown): input is Move {
  if (!isRecord(input)) {
    return false;
  }

  if ("drop" in input) {
    return typeof input.drop === "string" && DROP_KINDS.has(input.drop) && isPosition(input.to);
  }

  if (!isPosition(input.from) || !isPosition(input.to)) {
    return false;
  }

  if ("promote" in input && typeof input.promote !== "boolean") {
    return false;
  }

  return true;
}

export function isValidCreateGameInput(input: unknown): input is CreateGameInput {
  if (!isRecord(input)) {
    return false;
  }

  if (!Number.isInteger(input.mainMinutes) || (input.mainMinutes as number) <= 0) {
    return false;
  }
  if (!Number.isInteger(input.byoSeconds) || (input.byoSeconds as number) < 0) {
    return false;
  }
  const byoSeconds = input.byoSeconds as number;
  return byoSeconds === 0 || byoSeconds % 10 === 0;
}

export function isValidJoinGameInput(input: unknown): input is JoinGameInput {
  if (!isRecord(input)) {
    return false;
  }

  const name = typeof input.name === "string" ? input.name : "";
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
    return false;
  }
  if (input.seat !== "black" && input.seat !== "white") {
    return false;
  }
  return typeof input.joinToken === "string" && input.joinToken.length >= 16;
}

export function isMoveRequestBody(input: unknown): input is MoveRequestBody {
  if (!isRecord(input)) {
    return false;
  }
  if (!Number.isInteger(input.expectedVersion) || (input.expectedVersion as number) < 1) {
    return false;
  }
  return isMoveShape(input.move);
}
