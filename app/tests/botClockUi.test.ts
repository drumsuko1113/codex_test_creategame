import { describe, expect, test } from "vitest";
import { readSource } from "./support/sourceReader";

describe("bot clock UI", () => {
  test("renders both clock panels only in online mode", () => {
    const app = readSource("app/src/App.tsx");
    const allClockPanels = app.match(/<div className=\"clock-panel\">/g) ?? [];
    const conditionalClockPanels = app.match(/matchMode === \"online\"\s*\?\s*\(\s*<div className=\"clock-panel\">/g) ?? [];

    expect(allClockPanels).toHaveLength(2);
    expect(conditionalClockPanels).toHaveLength(2);
  });
});
