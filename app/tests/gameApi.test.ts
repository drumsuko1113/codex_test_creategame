import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiClientError, createGame, getGameSnapshot, getSessionPlayer, joinGame, matchLobby, resignGame, submitMove } from "../src/online/gameApi";

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

  test("matchLobby sends POST /api/lobby/match and returns payload", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          gameId: "game-1",
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

    const result = await matchLobby(
      {
        passphrase: "Room123",
        name: "player-1",
      },
      "http://127.0.0.1:3000",
    );

    expect(result).toEqual({
      gameId: "game-1",
      guestId: "guest-1",
      sessionToken: "session-1",
      managedToken: null,
      seat: "black",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/lobby/match",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body)).toEqual({
      passphrase: "Room123",
      name: "player-1",
    });
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

  test("getGameSnapshot fetches current game state", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "game-1",
          status: "active",
          turn: "black",
          state: { board: [], hands: { black: {}, white: {} }, turn: "black" },
          mainSecondsBlack: 300,
          mainSecondsWhite: 300,
          byoSecondsBlack: 30,
          byoSecondsWhite: 30,
          resultType: null,
          winner: null,
          version: 2,
          turnStartedAtMs: 1000,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:10.000Z",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await getGameSnapshot("game-1", "http://127.0.0.1:3000");

    expect(result.id).toBe("game-1");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3000/api/games/game-1", undefined);
  });

  test("normalizes baseUrl when trailing slash is provided", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "game-1",
          status: "active",
          turn: "black",
          state: { board: [], hands: { black: {}, white: {} }, turn: "black" },
          mainSecondsBlack: 300,
          mainSecondsWhite: 300,
          byoSecondsBlack: 30,
          byoSecondsWhite: 30,
          resultType: null,
          winner: null,
          version: 2,
          turnStartedAtMs: 1000,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:10.000Z",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await getGameSnapshot("game-1", "http://127.0.0.1:3000/");

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3000/api/games/game-1", undefined);
  });

  test("submitMove sends expectedVersion and authorization header", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "game-1",
          status: "active",
          turn: "white",
          state: { board: [], hands: { black: {}, white: {} }, turn: "white" },
          mainSecondsBlack: 299,
          mainSecondsWhite: 300,
          byoSecondsBlack: 30,
          byoSecondsWhite: 30,
          resultType: null,
          winner: null,
          version: 3,
          turnStartedAtMs: 2000,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:11.000Z",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await submitMove(
      {
        gameId: "game-1",
        sessionToken: "session-1",
        expectedVersion: 2,
        move: { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
      },
      "http://127.0.0.1:3000",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/games/game-1/moves",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer session-1",
        },
      }),
    );
    expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body)).toEqual({
      expectedVersion: 2,
      move: { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
    });
  });

  test("resignGame sends auth header", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "game-1",
          status: "finished",
          turn: "white",
          state: { board: [], hands: { black: {}, white: {} }, turn: "white" },
          mainSecondsBlack: 299,
          mainSecondsWhite: 300,
          byoSecondsBlack: 30,
          byoSecondsWhite: 30,
          resultType: "resign",
          winner: "white",
          version: 4,
          turnStartedAtMs: 3000,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:12.000Z",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await resignGame(
      {
        gameId: "game-1",
        sessionToken: "session-1",
      },
      "http://127.0.0.1:3000",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/games/game-1/resign",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer session-1",
        },
      }),
    );
  });

  test("getSessionPlayer sends auth header and returns player payload", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          gameId: "game-1",
          guestId: "guest-1",
          seat: "black",
          displayName: "black-player",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await getSessionPlayer(
      {
        gameId: "game-1",
        sessionToken: "session-1",
      },
      "http://127.0.0.1:3000",
    );

    expect(result).toEqual({
      gameId: "game-1",
      guestId: "guest-1",
      seat: "black",
      displayName: "black-player",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/games/game-1/me",
      expect.objectContaining({
        headers: {
          authorization: "Bearer session-1",
        },
      }),
    );
  });
});
