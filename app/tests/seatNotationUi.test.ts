import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

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
