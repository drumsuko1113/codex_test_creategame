import { gameStateToSfen } from "./sfen";
import { type GameState } from "./types";

function normalizeSfenForRepetition(state: GameState): string {
  // Move number is not part of repetition identity in this project.
  return gameStateToSfen(state).split(" ").slice(0, 3).join(" ");
}

export function findSamePositionIndices(history: GameState[], target: GameState): number[] {
  const targetKey = normalizeSfenForRepetition(target);
  const indices: number[] = [];

  history.forEach((state, index) => {
    if (normalizeSfenForRepetition(state) === targetKey) {
      indices.push(index);
    }
  });

  return indices;
}

export function countSamePosition(history: GameState[], target: GameState): number {
  return findSamePositionIndices(history, target).length;
}

export function isFourfoldRepetition(history: GameState[]): boolean {
  if (history.length === 0) {
    return false;
  }

  const latest = history[history.length - 1];
  return countSamePosition(history, latest) >= 4;
}
