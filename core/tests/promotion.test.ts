import { canPromote, shouldAutoPromote } from "../src/promotion";

describe("promotion", () => {
  it("allows pawn promotion", () => {
    expect(canPromote({ kind: "pawn", color: "black", promoted: false })).toBe(true);
  });

  it("forces pawn promotion on last rank", () => {
    const forced = shouldAutoPromote(
      { kind: "pawn", color: "black", promoted: false },
      { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } },
    );
    expect(forced).toBe(true);
  });
});
