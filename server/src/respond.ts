import type { ServerResponse } from "node:http";
import { writeJson } from "./http";
import { log } from "./logger";
import type { RequestContext } from "./context";

export type ResponseMeta = {
  gameId?: string;
  guestId?: string;
  event?: string;
};

export function respond(
  res: ServerResponse,
  ctx: RequestContext,
  statusCode: number,
  body: unknown,
  meta?: ResponseMeta,
): void {
  res.setHeader("x-request-id", ctx.requestId);
  writeJson(res, statusCode, body);
  log({
    level: "info",
    event: meta?.event ?? "http.response",
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    statusCode,
    gameId: meta?.gameId,
    guestId: meta?.guestId,
  });
}

export function respondError(
  res: ServerResponse,
  ctx: RequestContext,
  statusCode: number,
  code: string,
  message: string,
  meta?: ResponseMeta,
): void {
  respond(res, ctx, statusCode, { error: { code, message } }, meta);
}
