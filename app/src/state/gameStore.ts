import { createInitialGameState } from "../../../core/src/initialPosition";

export function createGameStore() {
  return {
    state: createInitialGameState(),
  };
}
