export const MIN_PLAYER_NAME_LENGTH = 2;
export const MAX_PLAYER_NAME_LENGTH = 20;
export const MAX_LOBBY_PASSPHRASE_LENGTH = 8;

const LOBBY_PASSPHRASE_PATTERN = /^[A-Za-z0-9]+$/;

export function isValidPlayerName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= MIN_PLAYER_NAME_LENGTH && trimmed.length <= MAX_PLAYER_NAME_LENGTH;
}

export function isValidLobbyPassphrase(passphrase: string): boolean {
  const trimmed = passphrase.trim();
  return trimmed.length > 0
    && trimmed.length <= MAX_LOBBY_PASSPHRASE_LENGTH
    && LOBBY_PASSPHRASE_PATTERN.test(trimmed);
}
