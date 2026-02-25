import { describe, expect, test } from "vitest";
import { getBotResignOutcome, isBotTurn } from "../src/game/botMode";
import { winnerLabel } from "../src/game/moveText";

describe("botMode", () => {
  test("determines bot turn from player seat and current turn", () => {
    expect(isBotTurn("black", "white")).toBe(true);
    expect(isBotTurn("white", "black")).toBe(true);
    expect(isBotTurn("black", "black")).toBe(false);
    expect(isBotTurn("white", "white")).toBe(false);
  });

  test("builds resign outcome where bot wins when player resigns", () => {
    expect(getBotResignOutcome("black")).toEqual({
      winner: "white",
      resultText: `${winnerLabel("white")}\u306e\u52dd\u3061\uff08\u6295\u4e86\uff09`,
    });
    expect(getBotResignOutcome("white")).toEqual({
      winner: "black",
      resultText: `${winnerLabel("black")}\u306e\u52dd\u3061\uff08\u6295\u4e86\uff09`,
    });
  });
});
