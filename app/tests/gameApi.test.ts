import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiClientError, createGame, joinGame } from "../src/online/gameApi";

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe("gameApi", () => {
  test("createGame sends POST /api/games and returns payload", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ gameId: "game-1", joinToken: "token-1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await createGame({ mainMinutes: 5, byoSeconds: 30 }, "http://127.0.0.1:3000");

    expect(result).toEqual({ gameId: "game-1", joinToken: "token-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/games",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
  });

  test("joinGame sends POST /api/games/{gameId}/join and returns payload", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          guestId: "guest-1",
          sessionToken: "session-1",
          managedToken: null,
          seat: "black",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await joinGame(
      {
        gameId: "game-1",
        joinToken: "token-1",
        name: "black-player",
        seat: "black",
      },
      "http://127.0.0.1:3000",
    );

    expect(result).toEqual({
      guestId: "guest-1",
      sessionToken: "session-1",
      managedToken: null,
      seat: "black",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/games/game-1/join",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  test("throws ApiClientError with code/status for failed response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "INVALID_JOIN_TOKEN",
            message: "Join token is invalid",
          },
        }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      joinGame(
        {
          gameId: "game-1",
          joinToken: "bad-token",
          name: "player",
          seat: "black",
        },
        "http://127.0.0.1:3000",
      ),
    ).rejects.toEqual(new ApiClientError(401, "INVALID_JOIN_TOKEN", "Join token is invalid"));
  });
});
