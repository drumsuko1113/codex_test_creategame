import { describe, expect, test } from "vitest";
import { readSource } from "./support/sourceReader";

describe("game layout css", () => {
  test("keeps board and hand anchors fixed even on narrow screens", () => {
    const css = readSource("app/src/styles/globals.css");
    expect(css).toMatch(/\.hand-anchor\s*\{[\s\S]*?position:\s*absolute;/);

    const narrowMediaStart = css.indexOf("@media (max-width: 980px) {");
    expect(narrowMediaStart).toBeGreaterThanOrEqual(0);
    const nextMediaStart = css.indexOf("@media (min-width: 860px)", narrowMediaStart);
    const block = css.slice(
      narrowMediaStart,
      nextMediaStart === -1 ? undefined : nextMediaStart,
    );

    expect(block).not.toMatch(/\.game-area\s*\{/);
    expect(block).not.toMatch(/\.hand-anchor\s*\{/);
    expect(block).not.toMatch(/order:\s*\d/);
    expect(block).not.toMatch(/position:\s*static/);
  });
});
