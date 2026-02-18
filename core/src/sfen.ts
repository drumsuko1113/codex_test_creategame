import { type GameState } from "./types";

export function gameStateToSfen(_state: GameState): string {
  // TODO: Implement full SFEN conversion.
  return "";
}

export function sfenToGameState(_sfen: string): GameState {
  throw new Error("Not implemented");
}
