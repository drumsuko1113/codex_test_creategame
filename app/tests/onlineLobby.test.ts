import { describe, expect, test } from "vitest";
import { formatLobbyError, validateMatchLobbyForm, validateSpectateGameForm } from "../src/online/lobbyValidation";

describe("lobby validation", () => {
  test("validateMatchLobbyForm returns errors when required fields are invalid", () => {
    const result = validateMatchLobbyForm({
      passphrase: "",
      name: "a",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toContain("合言葉を入力してください。");
    expect(result.errors).toContain("表示名は2〜20文字で入力してください。");
  });

  test("validateMatchLobbyForm trims and accepts valid input", () => {
    const result = validateMatchLobbyForm({
      passphrase: " Room123 ",
      name: "  player-1  ",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        passphrase: "Room123",
        name: "player-1",
      },
    });
  });

  test("validateMatchLobbyForm rejects non-alphanumeric passphrase and long passphrase", () => {
    const invalidChars = validateMatchLobbyForm({ passphrase: "abc-123", name: "player-1" });
    expect(invalidChars.ok).toBe(false);
    if (!invalidChars.ok) {
      expect(invalidChars.errors).toContain("合言葉は半角英数字8文字以内で入力してください。");
    }

    const invalidLength = validateMatchLobbyForm({ passphrase: "abcdefghi", name: "player-1" });
    expect(invalidLength.ok).toBe(false);
    if (!invalidLength.ok) {
      expect(invalidLength.errors).toContain("合言葉は半角英数字8文字以内で入力してください。");
    }
  });

  test("validateSpectateGameForm returns error when gameId is empty", () => {
    const result = validateSpectateGameForm({ gameId: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors).toContain("観戦するgameIdを入力してください。");
  });

  test("validateSpectateGameForm trims and accepts valid gameId", () => {
    const result = validateSpectateGameForm({ gameId: "  game-123  " });
    expect(result).toEqual({
      ok: true,
      value: {
        gameId: "game-123",
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
