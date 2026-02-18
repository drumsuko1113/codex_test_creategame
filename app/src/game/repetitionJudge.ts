import { type Color, type GameState } from "../../../core/src/types";

export function findPerpetualCheckLoser(
  stateHistory: GameState[],
  checkingHistory: Array<Color | null>,
  startStateIndex: number,
  endStateIndex: number,
): Color | null {
  const isContinuousBy = (color: Color): boolean => {
    let sawOwnMove = false;

    for (let moveIndex = startStateIndex; moveIndex < endStateIndex; moveIndex += 1) {
      const mover = stateHistory[moveIndex].turn;
      if (mover !== color) {
        continue;
      }

      sawOwnMove = true;
      if (checkingHistory[moveIndex] !== color) {
        return false;
      }
    }

    return sawOwnMove;
  };

  const blackContinuous = isContinuousBy("black");
  const whiteContinuous = isContinuousBy("white");

  if (blackContinuous && !whiteContinuous) {
    return "black";
  }

  if (whiteContinuous && !blackContinuous) {
    return "white";
  }

  return null;
}
