import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

describe("game summary UI", () => {
  test("does not render the title-under summary row", () => {
    const app = readSource("app/src/App.tsx");
    expect(app).not.toContain('className="session-summary"');
    expect(app).not.toContain("mode: spectator / gameId:");
    expect(app).not.toContain("/ version: ${gameVersion}");
  });
});
