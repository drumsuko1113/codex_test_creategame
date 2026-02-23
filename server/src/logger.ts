type LogLevel = "info" | "error";

type LogPayload = {
  level: LogLevel;
  event: string;
  requestId?: string;
  gameId?: string;
  guestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  message?: string;
};

export function log(payload: LogPayload): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...payload }));
}
