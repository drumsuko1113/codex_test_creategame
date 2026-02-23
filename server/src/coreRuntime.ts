import { applyMove } from "../../core/src/applyMove";
import { createInitialGameState } from "../../core/src/initialPosition";

export function verifyCoreRuntime(): void {
  const initial = createInitialGameState();
  const result = applyMove(initial, {
    from: { x: 0, y: 6 },
    to: { x: 0, y: 5 },
  });

  if (!result.ok) {
    throw new Error(`core.applyMove integration check failed: ${result.reason}`);
  }
}
