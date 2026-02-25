import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app";

const app = createApp();
let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    app.listen(0, () => {
      const address = app.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    app.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

describe("request validation errors", () => {
  test("returns 400 when JSON body is malformed", async () => {
    const response = await fetch(`${baseUrl}/api/games`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error?: { code?: string } };
    expect(payload.error?.code).toBe("INVALID_JSON");
  });

  test("returns 400 when create payload is null", async () => {
    const response = await fetch(`${baseUrl}/api/games`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error?: { code?: string } };
    expect(payload.error?.code).toBe("INVALID_CREATE_GAME_PAYLOAD");
  });

  test("returns 400 when move payload shape is invalid", async () => {
    const createRes = await fetch(`${baseUrl}/api/games`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mainMinutes: 5, byoSeconds: 30 }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { gameId: string; joinToken: string };

    const blackJoinRes = await fetch(`${baseUrl}/api/games/${created.gameId}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "black", seat: "black", joinToken: created.joinToken }),
    });
    expect(blackJoinRes.status).toBe(200);
    const blackJoin = (await blackJoinRes.json()) as { sessionToken: string };

    const whiteJoinRes = await fetch(`${baseUrl}/api/games/${created.gameId}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "white", seat: "white", joinToken: created.joinToken }),
    });
    expect(whiteJoinRes.status).toBe(200);

    const snapshotRes = await fetch(`${baseUrl}/api/games/${created.gameId}`);
    expect(snapshotRes.status).toBe(200);
    const snapshot = (await snapshotRes.json()) as { version: number };

    const badMoveRes = await fetch(`${baseUrl}/api/games/${created.gameId}/moves`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${blackJoin.sessionToken}`,
      },
      body: JSON.stringify({ expectedVersion: snapshot.version, move: {} }),
    });

    expect(badMoveRes.status).toBe(400);
    const payload = (await badMoveRes.json()) as { error?: { code?: string } };
    expect(payload.error?.code).toBe("INVALID_MOVE_PAYLOAD");
  });
});
