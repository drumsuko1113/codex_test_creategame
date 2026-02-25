const SPECTATE_QUERY_KEY = "spectate";

export function buildSpectatorUrl(origin: string, pathname: string, gameId: string): string {
  const target = new URL(pathname, origin);
  target.searchParams.set(SPECTATE_QUERY_KEY, gameId.trim());
  return target.toString();
}

export function parseSpectateGameId(search: string): string | null {
  const params = new URLSearchParams(search);
  const gameId = params.get(SPECTATE_QUERY_KEY)?.trim();
  if (!gameId) {
    return null;
  }
  return gameId;
}
