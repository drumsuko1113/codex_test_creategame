import { describe, expect, test } from "vitest";
import { buildSpectatorUrl, parseSpectateGameId } from "../src/online/spectatorLink";

describe("spectatorLink", () => {
  test("builds spectator url with spectate query parameter", () => {
    expect(buildSpectatorUrl("https://example.com", "/app", "game-123")).toBe(
      "https://example.com/app?spectate=game-123",
    );
  });

  test("parses and trims spectate gameId from search", () => {
    expect(parseSpectateGameId("?spectate=game-123")).toBe("game-123");
    expect(parseSpectateGameId("?spectate=%20game-123%20")).toBe("game-123");
  });

  test("returns null when spectate parameter is missing or empty", () => {
    expect(parseSpectateGameId("?foo=bar")).toBeNull();
    expect(parseSpectateGameId("?spectate=")).toBeNull();
    expect(parseSpectateGameId("?spectate=%20%20")).toBeNull();
  });
});
