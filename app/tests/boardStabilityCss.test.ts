import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readGlobalCss(): string {
  return readFileSync(join(process.cwd(), "app/src/styles/globals.css"), "utf8");
}

describe("board stability css", () => {
  test("keeps move history viewport height fixed to avoid move-time layout shifts", () => {
    const css = readGlobalCss().replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    const match = css.match(/\.history-list\s*\{([\s\S]*?)\}/);
    expect(match).not.toBeNull();
    const block = match?.[1] ?? "";

    expect(block).toMatch(/height:\s*220px;/);
    expect(block).toMatch(/overflow(?:-y)?:\s*auto;/);
    expect(block).not.toMatch(/max-height:/);
  });
});
