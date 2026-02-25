import type { Color } from "../../../core/src/types";
import { winnerLabel } from "./moveText";

export function isBotTurn(playerSeat: Color, turn: Color): boolean {
  return playerSeat !== turn;
}

export function getBotResignOutcome(playerSeat: Color): { winner: Color; resultText: string } {
  const winner: Color = playerSeat === "black" ? "white" : "black";
  return {
    winner,
    resultText: `${winnerLabel(winner)}\u306e\u52dd\u3061\uff08\u6295\u4e86\uff09`,
  };
}
