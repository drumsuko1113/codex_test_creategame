import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
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

function waitForOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      socket.off("error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      socket.off("open", onOpen);
      reject(error);
    };
    socket.once("open", onOpen);
    socket.once("error", onError);
  });
}

function waitForMessage(socket: WebSocket, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("websocket message timeout"));
    }, timeoutMs);

    const onMessage = (raw: WebSocket.RawData) => {
      clearTimeout(timeoutId);
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      resolve(text);
    };

    socket.once("message", onMessage);
  });
}

describe("realtime websocket events", () => {
  test("broadcasts game.updated snapshot after move", async () => {
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

    const wsUrl = baseUrl.replace("http://", "ws://");
    const socket = new WebSocket(`${wsUrl}/api/games/${created.gameId}/events`);
    await waitForOpen(socket);

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

    const event = JSON.parse(await waitForMessage(socket)) as {
      type: string;
      payload: { id: string; version: number };
    };

    expect(event.type).toBe("game.updated");
    expect(event.payload.id).toBe(created.gameId);
    expect(event.payload.version).toBe(snapshot.version + 1);

    socket.close();
  });
});
