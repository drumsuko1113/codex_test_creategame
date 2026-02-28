import { describe, expect, test, vi } from "vitest";
import { InMemoryStore } from "../src/store";

describe("InMemoryStore clock handling", () => {
  test("deducts elapsed time only once on submitMove", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000_000);

    const store = new InMemoryStore();
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
      nowSpy.mockRestore();
      return;
    }

    const expectedVersion = game.version;

    nowSpy.mockReturnValue(1_002_000);

    const actor = await store.findPlayerByGuestId(created.gameId, black.guestId);
    expect(actor).not.toBeNull();
    if (!actor) {
      nowSpy.mockRestore();
      return;
    }

    const updated = await store.submitMove(
      created.gameId,
      actor,
      { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
      expectedVersion,
    );

    expect(updated.mainSecondsBlack).toBe(298);
    nowSpy.mockRestore();
  });

  test("does not over-deduct clock on repeated snapshots", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000_000);

    const store = new InMemoryStore();
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

    const game = await store.getGame(created.gameId);
    expect(game).not.toBeNull();
    if (!game) {
      nowSpy.mockRestore();
      return;
    }

    nowSpy.mockReturnValue(1_002_000);
    const firstSnapshot = await store.getGame(created.gameId);
    expect(firstSnapshot?.mainSecondsBlack).toBe(298);

    nowSpy.mockReturnValue(1_004_000);
    const secondSnapshot = await store.getGame(created.gameId);
    expect(secondSnapshot?.mainSecondsBlack).toBe(296);

    nowSpy.mockRestore();
  });

  test("reflects byo-yomi countdown in snapshots and times out after expiration", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000_000);

    const store = new InMemoryStore();
    const created = await store.createGame({ mainMinutes: 0, byoSeconds: 30 });
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

    const game = await store.getGame(created.gameId);
    expect(game).not.toBeNull();
    if (!game) {
      nowSpy.mockRestore();
      return;
    }

    nowSpy.mockReturnValue(1_010_000);
    const active = await store.getGame(created.gameId);
    expect(active?.status).toBe("active");
    expect(active?.mainSecondsBlack).toBe(0);
    expect(active?.byoSecondsBlack).toBe(20);

    nowSpy.mockReturnValue(1_031_000);
    const finished = await store.getGame(created.gameId);
    expect(finished?.status).toBe("finished");
    expect(finished?.resultType).toBe("timeout");
    expect(finished?.winner).toBe("white");

    nowSpy.mockRestore();
  });
});
