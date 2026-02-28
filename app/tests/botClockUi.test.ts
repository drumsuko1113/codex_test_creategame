import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

describe("bot clock UI", () => {
  test("renders both clock panels only in online mode", () => {
    const app = readSource("app/src/App.tsx");
    const allClockPanels = app.match(/<div className=\"clock-panel\">/g) ?? [];
    const conditionalClockPanels = app.match(/matchMode === \"online\"\s*\?\s*\(\s*<div className=\"clock-panel\">/g) ?? [];

    expect(allClockPanels).toHaveLength(2);
    expect(conditionalClockPanels).toHaveLength(2);
  });
});
