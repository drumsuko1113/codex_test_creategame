import { describe, expect, test } from "vitest";
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
  type StoredSession,
  type StorageLike,
} from "../src/online/sessionPersistence";

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function sampleSession(): StoredSession {
  return {
    gameId: "game-1",
    sessionToken: "session-token-1",
    seat: "black",
    displayName: "player-1",
  };
}

describe("sessionPersistence", () => {
  test("saves and loads stored session", () => {
    const storage = new MemoryStorage();
    const session = sampleSession();

    saveStoredSession(session, storage);

    expect(loadStoredSession(storage)).toEqual(session);
  });

  test("returns null for malformed data", () => {
    const storage = new MemoryStorage();
    storage.setItem("shogi.online.session.v1", "{invalid-json");

    expect(loadStoredSession(storage)).toBeNull();
  });

  test("returns null when required fields are missing", () => {
    const storage = new MemoryStorage();
    storage.setItem("shogi.online.session.v1", JSON.stringify({ gameId: "game-1" }));

    expect(loadStoredSession(storage)).toBeNull();
  });

  test("clears saved session", () => {
    const storage = new MemoryStorage();
    saveStoredSession(sampleSession(), storage);

    clearStoredSession(storage);

    expect(loadStoredSession(storage)).toBeNull();
  });
});
