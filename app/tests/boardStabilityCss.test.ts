import { describe, expect, test } from "vitest";
import { readSource } from "./support/sourceReader";

describe("board stability css", () => {
  test("keeps move history viewport height fixed to avoid move-time layout shifts", () => {
    const css = readSource("app/src/styles/globals.css");
    const match = css.match(/\.history-list\s*\{([\s\S]*?)\}/);
    expect(match).not.toBeNull();
    const block = match?.[1] ?? "";

    expect(block).toMatch(/height:\s*220px;/);
    expect(block).toMatch(/overflow(?:-y)?:\s*auto;/);
    expect(block).not.toMatch(/max-height:/);
  });
});
