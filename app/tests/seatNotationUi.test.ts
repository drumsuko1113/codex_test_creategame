import { describe, expect, test } from "vitest";
import { readSource } from "./support/sourceReader";

describe("UI seat notation", () => {
  test("uses 先手/後手 labels instead of Black/White in setup UI", () => {
    const setupScreen = readSource("app/src/ui/SetupScreen.tsx");
    expect(setupScreen).toContain("先手");
    expect(setupScreen).toContain("後手");
    expect(setupScreen).not.toMatch(/>\s*black\s*</);
    expect(setupScreen).not.toMatch(/>\s*white\s*</);

    const app = readSource("app/src/App.tsx");
    expect(app).not.toContain("seat: ${session.seat}");
  });
});
