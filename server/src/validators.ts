import type { Move } from "../../core/src/types";
import type { CreateGameInput, JoinGameInput, LobbyMatchInput } from "./types";

export type MoveRequestBody = {
  move: Move;
  expectedVersion: number;
};

type JsonRecord = Record<string, unknown>;

const BOARD_MIN_INDEX = 0;
const BOARD_MAX_INDEX = 8;
const MIN_MAIN_MINUTES = 1;
const MIN_BYO_SECONDS = 0;
const BYO_SECONDS_STEP = 10;
const MIN_PLAYER_NAME_LENGTH = 2;
const MAX_PLAYER_NAME_LENGTH = 20;
const MIN_JOIN_TOKEN_LENGTH = 16;
const MAX_PASSPHRASE_LENGTH = 8;
const VALID_SEATS = new Set<JoinGameInput["seat"]>(["black", "white"]);
const DROP_KINDS = new Set(["rook", "bishop", "gold", "silver", "knight", "lance", "pawn"]);
const PASSPHRASE_PATTERN = /^[A-Za-z0-9]+$/;

function isRecord(input: unknown): input is JsonRecord {
  return !!input && typeof input === "object";
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isPosition(input: unknown): input is { x: number; y: number } {
  if (!isRecord(input)) {
    return false;
  }

  return isIntegerInRange(input.x, BOARD_MIN_INDEX, BOARD_MAX_INDEX)
    && isIntegerInRange(input.y, BOARD_MIN_INDEX, BOARD_MAX_INDEX);
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

  if (!isIntegerInRange(input.mainMinutes, MIN_MAIN_MINUTES, Number.MAX_SAFE_INTEGER)) {
    return false;
  }

  if (!isIntegerInRange(input.byoSeconds, MIN_BYO_SECONDS, Number.MAX_SAFE_INTEGER)) {
    return false;
  }

  const byoSeconds = input.byoSeconds as number;
  return byoSeconds === MIN_BYO_SECONDS || byoSeconds % BYO_SECONDS_STEP === 0;
}

export function isValidJoinGameInput(input: unknown): input is JoinGameInput {
  if (!isRecord(input)) {
    return false;
  }

  if (!isValidPlayerName(input.name)) {
    return false;
  }

  if (!VALID_SEATS.has(input.seat as JoinGameInput["seat"])) {
    return false;
  }

  return typeof input.joinToken === "string" && input.joinToken.length >= MIN_JOIN_TOKEN_LENGTH;
}

function isValidPlayerName(name: unknown): boolean {
  if (typeof name !== "string") {
    return false;
  }

  const trimmed = name.trim();
  return trimmed.length >= MIN_PLAYER_NAME_LENGTH && trimmed.length <= MAX_PLAYER_NAME_LENGTH;
}

export function isValidLobbyMatchInput(input: unknown): input is LobbyMatchInput {
  if (!isRecord(input)) {
    return false;
  }

  if (!isValidPlayerName(input.name)) {
    return false;
  }

  if (typeof input.passphrase !== "string") {
    return false;
  }

  const passphrase = input.passphrase.trim();
  return passphrase.length > 0 && passphrase.length <= MAX_PASSPHRASE_LENGTH && PASSPHRASE_PATTERN.test(passphrase);
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
