import { describe, expect, test } from "vitest";
import { readSource } from "./support/sourceReader";

describe("game summary UI", () => {
  test("does not render the title-under summary row", () => {
    const app = readSource("app/src/App.tsx");
    expect(app).not.toContain('className="session-summary"');
    expect(app).not.toContain("mode: spectator / gameId:");
    expect(app).not.toContain("/ version: ${gameVersion}");
  });
});
