import { describe, expect, test, vi } from "vitest";
import { InMemoryStore } from "../src/store";

describe("InMemoryStore clock handling", () => {
  test("deducts elapsed time only once on submitMove", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000_000);

    const store = new InMemoryStore();
    const created = store.createGame({ mainMinutes: 5, byoSeconds: 30 });
    const black = store.joinGame(created.gameId, {
      name: "black",
      seat: "black",
      joinToken: created.joinToken,
    });
    store.joinGame(created.gameId, {
      name: "white",
      seat: "white",
      joinToken: created.joinToken,
    });

    const game = store.getGame(created.gameId);
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

    const actor = store.findPlayerByGuestId(created.gameId, black.guestId);
    expect(actor).not.toBeNull();
    if (!actor) {
      nowSpy.mockRestore();
      return;
    }

    const updated = store.submitMove(
      created.gameId,
      actor,
      { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
      expectedVersion,
    );

    expect(updated.mainSecondsBlack).toBe(98);
    nowSpy.mockRestore();
  });
});
