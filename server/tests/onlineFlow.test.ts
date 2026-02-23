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

describe("online match backend flow", () => {
  test("create -> join -> move -> resign", async () => {
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

    const moveRes = await fetch(`${baseUrl}/api/games/${created.gameId}/moves`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${blackJoin.sessionToken}`,
      },
      body: JSON.stringify({
        expectedVersion: snapshot.version,
        move: { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
      }),
    });
    expect(moveRes.status).toBe(200);

    const resignRes = await fetch(`${baseUrl}/api/games/${created.gameId}/resign`, {
      method: "POST",
      headers: { authorization: `Bearer ${blackJoin.sessionToken}` },
    });
    expect(resignRes.status).toBe(200);
    const resigned = (await resignRes.json()) as { status: string; winner: string; resultType: string };
    expect(resigned.status).toBe("finished");
    expect(resigned.winner).toBe("white");
    expect(resigned.resultType).toBe("resign");
  });
});
