import { createInitialGameState } from "../src/initialPosition";
import { applyMove } from "../src/applyMove";

describe("applyMove", () => {
  it("switches turn on legal move", () => {
    const state = createInitialGameState();
    const result = applyMove(state, { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.turn).toBe("white");
    }
  });
});
