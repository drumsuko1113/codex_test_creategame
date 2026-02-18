import { isInCheck } from "./check";
import { gameStateToSfen } from "./sfen";
import { type Color, type GameState } from "./types";

export type RepetitionJudgeResult =
  | { kind: "none" }
  | { kind: "draw" }
  | { kind: "perpetual-check-loss"; loser: Color };

function normalizeSfenForRepetition(state: GameState): string {
  // Move number is not part of repetition identity in this project.
  return gameStateToSfen(state).split(" ").slice(0, 3).join(" ");
}

function oppositeColor(color: Color): Color {
  return color === "black" ? "white" : "black";
}

function findOccurrenceIndices(history: GameState[], target: GameState): number[] {
  const targetKey = normalizeSfenForRepetition(target);
  const indices: number[] = [];

  history.forEach((state, index) => {
    if (normalizeSfenForRepetition(state) === targetKey) {
      indices.push(index);
    }
  });

  return indices;
}

function isPerpetualCheckBy(history: GameState[], startIndex: number, endIndex: number, attacker: Color): boolean {
  for (let moveIndex = startIndex; moveIndex < endIndex; moveIndex += 1) {
    const mover = history[moveIndex].turn;
    if (mover !== attacker) {
      continue;
    }

    if (!isInCheck(history[moveIndex + 1])) {
      return false;
    }
  }

  return true;
}

export function countSamePosition(history: GameState[], target: GameState): number {
  return findOccurrenceIndices(history, target).length;
}

export function isFourfoldRepetition(history: GameState[]): boolean {
  if (history.length === 0) {
    return false;
  }

  const latest = history[history.length - 1];
  return countSamePosition(history, latest) >= 4;
}

export function judgeRepetition(history: GameState[]): RepetitionJudgeResult {
  if (history.length === 0) {
    return { kind: "none" };
  }

  const latest = history[history.length - 1];
  const indices = findOccurrenceIndices(history, latest);
  if (indices.length < 4) {
    return { kind: "none" };
  }

  const recentFour = indices.slice(-4);
  const start = recentFour[0];
  const end = recentFour[3];

  const repeatedBy = oppositeColor(latest.turn);
  if (isPerpetualCheckBy(history, start, end, repeatedBy)) {
    return { kind: "perpetual-check-loss", loser: repeatedBy };
  }

  return { kind: "draw" };
}
