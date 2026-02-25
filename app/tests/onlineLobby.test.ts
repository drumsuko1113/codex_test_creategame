import { describe, expect, test } from "vitest";
import { formatLobbyError, validateCreateGameForm, validateJoinGameForm } from "../src/online/lobbyValidation";

describe("lobby validation", () => {
  test("validateCreateGameForm returns errors for invalid values", () => {
    const result = validateCreateGameForm({ mainMinutes: "0", byoSeconds: "7" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toContain("持ち時間は1分以上の整数で入力してください。");
    expect(result.errors).toContain("秒読みは0以上かつ10秒単位で入力してください。");
  });

  test("validateCreateGameForm normalizes valid values", () => {
    const result = validateCreateGameForm({ mainMinutes: "15", byoSeconds: "30" });
    expect(result).toEqual({
      ok: true,
      value: {
        mainMinutes: 15,
        byoSeconds: 30,
      },
    });
  });

  test("validateJoinGameForm returns errors when required fields are empty", () => {
    const result = validateJoinGameForm({
      gameId: "",
      joinToken: "",
      name: "a",
      seat: "black",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toContain("gameIdを入力してください。");
    expect(result.errors).toContain("joinTokenを入力してください。");
    expect(result.errors).toContain("表示名は2〜20文字で入力してください。");
  });

  test("validateJoinGameForm trims and accepts valid input", () => {
    const result = validateJoinGameForm({
      gameId: "12ab",
      joinToken: "f".repeat(32),
      name: "  player-1  ",
      seat: "white",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        gameId: "12ab",
        joinToken: "f".repeat(32),
        name: "player-1",
        seat: "white",
      },
    });
  });
});

describe("formatLobbyError", () => {
  test("maps API code to user-friendly text", () => {
    expect(formatLobbyError({ code: "INVALID_JOIN_TOKEN", status: 401, message: "Join token is invalid" })).toBe(
      "参加トークンが無効です。入力内容を確認してください。",
    );
  });

  test("falls back to status for unknown codes", () => {
    expect(formatLobbyError({ code: "UNKNOWN", status: 500, message: "Internal" })).toBe(
      "サーバーでエラーが発生しました。時間をおいて再試行してください。",
    );
  });
});
