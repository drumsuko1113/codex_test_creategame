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

    game.mainSecondsBlack = 100;
    game.turn = "black";
    game.status = "active";
    game.turnStartedAtMs = 1_000_000;
    const expectedVersion = game.version;

    nowSpy.mockReturnValue(1_001_500);

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

    expect(updated.mainSecondsBlack).toBe(99);
    nowSpy.mockRestore();
  });

  test("does not double consume clock time across repeated snapshots", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(2_000_000);

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

    game.mainSecondsBlack = 100;
    game.turn = "black";
    game.status = "active";
    game.turnStartedAtMs = 2_000_000;

    nowSpy.mockReturnValue(2_005_000);
    const first = await store.getGame(created.gameId);
    expect(first?.mainSecondsBlack).toBe(95);

    nowSpy.mockReturnValue(2_006_000);
    const second = await store.getGame(created.gameId);
    expect(second?.mainSecondsBlack).toBe(94);

    nowSpy.mockRestore();
  });
});
