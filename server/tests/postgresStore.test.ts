import { afterAll, describe, expect, test, vi } from "vitest";
import { newDb } from "pg-mem";
import { PostgresStore } from "../src/store";

const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
const { Pool } = db.adapters.createPg();
const pool = new Pool();

afterAll(async () => {
  await pool.end();
});

describe("PostgresStore", () => {
  test("matches by passphrase and creates a new game after room is full", async () => {
    const store = new PostgresStore(pool);

    const first = await store.matchByPassphrase({ passphrase: "Room123", name: "first" });
    const second = await store.matchByPassphrase({ passphrase: "Room123", name: "second" });
    expect(second.gameId).toBe(first.gameId);
    expect(first.seat).toBe("black");
    expect(second.seat).toBe("white");

    const third = await store.matchByPassphrase({ passphrase: "Room123", name: "third" });
    expect(third.gameId).not.toBe(first.gameId);
    expect(third.seat).toBe("black");
  });

  test("persists game state and move records across store re-instantiation", async () => {
    const store1 = new PostgresStore(pool);
    const created = await store1.createGame({ mainMinutes: 5, byoSeconds: 30 });

    const black = await store1.joinGame(created.gameId, {
      name: "black",
      seat: "black",
      joinToken: created.joinToken,
    });
    await store1.joinGame(created.gameId, {
      name: "white",
      seat: "white",
      joinToken: created.joinToken,
    });

    const snapshot = await store1.getGame(created.gameId);
    expect(snapshot).not.toBeNull();
    if (!snapshot) {
      return;
    }

    const actor = await store1.findPlayerByGuestId(created.gameId, black.guestId);
    expect(actor).not.toBeNull();
    if (!actor) {
      return;
    }

    await store1.submitMove(
      created.gameId,
      actor,
      { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
      snapshot.version,
    );

    const store2 = new PostgresStore(pool);
    const restored = await store2.getGame(created.gameId);
    expect(restored).not.toBeNull();
    expect(restored?.version).toBe(snapshot.version + 1);

    const records = await store2.getMoves(created.gameId);
    expect(records).toHaveLength(1);
    expect(records[0]?.ply).toBe(1);
  });

  test("throws VERSION_CONFLICT when expectedVersion is stale", async () => {
    const store = new PostgresStore(pool);
    const created = await store.createGame({ mainMinutes: 5, byoSeconds: 30 });
    const black = await store.joinGame(created.gameId, {
      name: "black",
      seat: "black",
      joinToken: created.joinToken,
    });
    await store.joinGame(created.gameId, {
      name: "white",
      seat: "white",
      joinToken: created.joinToken,
    });

    const game = await store.getGame(created.gameId);
    expect(game).not.toBeNull();
    if (!game) {
      return;
    }

    const actor = await store.findPlayerByGuestId(created.gameId, black.guestId);
    expect(actor).not.toBeNull();
    if (!actor) {
      return;
    }

    await store.submitMove(
      created.gameId,
      actor,
      { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
      game.version,
    );

    await expect(
      store.submitMove(
        created.gameId,
        actor,
        { from: { x: 0, y: 5 }, to: { x: 0, y: 4 } },
        game.version,
      ),
    ).rejects.toThrow("VERSION_CONFLICT");
  });

  test("does not over-deduct clock on repeated snapshot fetches", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000_000);

    const store = new PostgresStore(pool);
    const created = await store.createGame({ mainMinutes: 5, byoSeconds: 30 });
    await store.joinGame(created.gameId, {
      name: "black",
      seat: "black",
      joinToken: created.joinToken,
    });
    await store.joinGame(created.gameId, {
      name: "white",
      seat: "white",
      joinToken: created.joinToken,
    });

    await pool.query(
      `UPDATE games
       SET status = 'active',
           turn = 'black',
           main_seconds_black = 100,
           turn_started_at_ms = $2
       WHERE id = $1`,
      [created.gameId, 1_000_000],
    );

    nowSpy.mockReturnValue(1_002_000);
    const firstSnapshot = await store.getGame(created.gameId);
    expect(firstSnapshot?.mainSecondsBlack).toBe(98);

    nowSpy.mockReturnValue(1_004_000);
    const secondSnapshot = await store.getGame(created.gameId);
    expect(secondSnapshot?.mainSecondsBlack).toBe(96);

    nowSpy.mockRestore();
  });

  test("deducts byo-yomi on submitMove after main time is exhausted", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000_000);

    const store = new PostgresStore(pool);
    const created = await store.createGame({ mainMinutes: 0, byoSeconds: 30 });
    const black = await store.joinGame(created.gameId, {
      name: "black",
      seat: "black",
      joinToken: created.joinToken,
    });
    await store.joinGame(created.gameId, {
      name: "white",
      seat: "white",
      joinToken: created.joinToken,
    });

    const game = await store.getGame(created.gameId);
    expect(game).not.toBeNull();
    if (!game) {
      nowSpy.mockRestore();
      return;
    }

    const actor = await store.findPlayerByGuestId(created.gameId, black.guestId);
    expect(actor).not.toBeNull();
    if (!actor) {
      nowSpy.mockRestore();
      return;
    }

    nowSpy.mockReturnValue(1_005_000);
    const updated = await store.submitMove(
      created.gameId,
      actor,
      { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
      game.version,
    );

    expect(updated.mainSecondsBlack).toBe(0);
    expect(updated.byoSecondsBlack).toBe(25);

    nowSpy.mockRestore();
  });
});
