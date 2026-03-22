import { describe, expect, test } from "vitest";
import { readSource } from "./support/sourceReader";

describe("application title", () => {
  test("uses 将棋倶楽部2.4 in UI headings and html title", () => {
    const app = readSource("app/src/App.tsx");
    const setupScreen = readSource("app/src/ui/SetupScreen.tsx");
    const indexHtml = readSource("app/index.html");

    expect(app).toContain("<h1>将棋倶楽部2.4</h1>");
    expect(setupScreen).toContain("<h1>将棋倶楽部2.4</h1>");
    expect(indexHtml).toContain("<title>将棋倶楽部2.4</title>");

    expect(app).not.toContain("<h1>Shogi Game</h1>");
    expect(setupScreen).not.toContain("<h1>Shogi Game</h1>");
    expect(indexHtml).not.toContain("<title>Shogi Game</title>");
  });
});
