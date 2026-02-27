import { describe, expect, test } from "vitest";
import { buildGameEventsWebSocketUrl, parseRealtimeSnapshotMessage } from "../src/online/realtimeEvents";
import type { GameSnapshot } from "../src/online/gameApi";

function createSnapshot(partial: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    id: "game-1",
    status: "active",
    turn: "black",
    state: {
      board: [],
      hands: { black: {}, white: {} },
      turn: "black",
    } as GameSnapshot["state"],
    mainSecondsBlack: 300,
    mainSecondsWhite: 300,
    byoSecondsBlack: 30,
    byoSecondsWhite: 30,
    resultType: null,
    winner: null,
    version: 2,
    turnStartedAtMs: 1_000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:01.000Z",
    ...partial,
  };
}

describe("realtimeEvents", () => {
  test("builds websocket url from http base", () => {
    expect(buildGameEventsWebSocketUrl("game-1", "http://127.0.0.1:3000/")).toBe(
      "ws://127.0.0.1:3000/api/games/game-1/events",
    );
  });

  test("builds websocket url from https base", () => {
    expect(buildGameEventsWebSocketUrl("game-1", "https://example.com")).toBe(
      "wss://example.com/api/games/game-1/events",
    );
  });

  test("parses game.updated snapshot message", () => {
    const snapshot = createSnapshot({ version: 5 });
    const raw = JSON.stringify({ type: "game.updated", payload: snapshot });
    expect(parseRealtimeSnapshotMessage(raw)).toEqual(snapshot);
  });

  test("ignores messages that are not snapshot updates", () => {
    const joined = JSON.stringify({ type: "player.joined", payload: { seat: "black" } });
    expect(parseRealtimeSnapshotMessage(joined)).toBeNull();
    expect(parseRealtimeSnapshotMessage("{invalid-json")).toBeNull();
  });
});
