type Seat = "black" | "white";

const PASS_PHRASE_PATTERN = /^[A-Za-z0-9]{1,8}$/;

export type CreateGameFormInput = {
  mainMinutes: string;
  byoSeconds: string;
};

export type JoinGameFormInput = {
  gameId: string;
  joinToken: string;
  name: string;
  seat: Seat;
};

export type MatchLobbyFormInput = {
  passphrase: string;
  name: string;
};

export type SpectateGameFormInput = {
  gameId: string;
};

type ValidationOk<T> = {
  ok: true;
  value: T;
};

type ValidationError = {
  ok: false;
  errors: string[];
};

export type ValidationResult<T> = ValidationOk<T> | ValidationError;

function toInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function hasValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 20;
}

export function validateCreateGameForm(input: CreateGameFormInput): ValidationResult<{ mainMinutes: number; byoSeconds: number }> {
  const errors: string[] = [];
  const mainMinutes = toInteger(input.mainMinutes);
  const byoSeconds = toInteger(input.byoSeconds);

  if (mainMinutes === null || mainMinutes < 1) {
    errors.push("持ち時間は1分以上の整数で入力してください。");
  }
  if (byoSeconds === null || byoSeconds < 0 || byoSeconds % 10 !== 0) {
    errors.push("秒読みは0以上かつ10秒単位で入力してください。");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      mainMinutes,
      byoSeconds,
    },
  };
}

export function validateJoinGameForm(
  input: JoinGameFormInput,
): ValidationResult<{ gameId: string; joinToken: string; name: string; seat: Seat }> {
  const errors: string[] = [];
  const gameId = input.gameId.trim();
  const joinToken = input.joinToken.trim();
  const name = input.name.trim();

  if (!gameId) {
    errors.push("gameIdを入力してください。");
  }
  if (!joinToken) {
    errors.push("joinTokenを入力してください。");
  }
  if (!hasValidName(name)) {
    errors.push("表示名は2〜20文字で入力してください。");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      gameId,
      joinToken,
      name,
      seat: input.seat,
    },
  };
}

export function validateMatchLobbyForm(input: MatchLobbyFormInput): ValidationResult<{ passphrase: string; name: string }> {
  const errors: string[] = [];
  const passphrase = input.passphrase.trim();
  const name = input.name.trim();

  if (!passphrase) {
    errors.push("合言葉を入力してください。");
  } else if (!PASS_PHRASE_PATTERN.test(passphrase)) {
    errors.push("合言葉は半角英数字8文字以内で入力してください。");
  }

  if (!hasValidName(name)) {
    errors.push("表示名は2〜20文字で入力してください。");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      passphrase,
      name,
    },
  };
}

export function validateSpectateGameForm(input: SpectateGameFormInput): ValidationResult<{ gameId: string }> {
  const errors: string[] = [];
  const gameId = input.gameId.trim();

  if (!gameId) {
    errors.push("観戦するgameIdを入力してください。");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      gameId,
    },
  };
}

type LobbyErrorInput = {
  status: number;
  code: string;
  message: string;
};

export function formatLobbyError(error: LobbyErrorInput): string {
  const byCode: Record<string, string> = {
    NETWORK_ERROR: "通信に失敗しました。ネットワーク状態を確認してください。",
    INVALID_CREATE_GAME_PAYLOAD: "対局作成フォームの入力値が不正です。",
    INVALID_MATCH_PAYLOAD: "合言葉または表示名の入力値が不正です。",
    GAME_NOT_FOUND: "指定された対局が見つかりません。gameIdを確認してください。",
    INVALID_JOIN_TOKEN: "参加トークンが無効です。入力内容を確認してください。",
    GAME_IS_FULL: "この対局はすでに満席です。",
    SEAT_ALREADY_TAKEN: "選択した席はすでに使用されています。",
    RATE_LIMIT_EXCEEDED: "アクセスが集中しています。少し待って再試行してください。",
  };

  if (error.code in byCode) {
    return byCode[error.code];
  }
  if (error.status >= 500) {
    return "サーバーでエラーが発生しました。時間をおいて再試行してください。";
  }
  if (error.status >= 400) {
    return error.message || "入力値を確認してください。";
  }
  return "予期しないエラーが発生しました。";
}
