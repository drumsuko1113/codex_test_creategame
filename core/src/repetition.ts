import { gameStateToSfen } from "./sfen";
import { type GameState } from "./types";

function normalizeSfenForRepetition(state: GameState): string {
  // Move number is not part of repetition identity in this project.
  return gameStateToSfen(state).split(" ").slice(0, 3).join(" ");
}

export function countSamePosition(history: GameState[], target: GameState): number {
  const targetKey = normalizeSfenForRepetition(target);
  return history.reduce((count, state) => {
    return normalizeSfenForRepetition(state) === targetKey ? count + 1 : count;
  }, 0);
}

export function isFourfoldRepetition(history: GameState[]): boolean {
  if (history.length === 0) {
    return false;
  }

  const latest = history[history.length - 1];
  return countSamePosition(history, latest) >= 4;
}
