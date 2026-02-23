import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

export type RequestContext = {
  requestId: string;
  method: string;
  path: string;
};

export function makeRequestContext(req: IncomingMessage): RequestContext {
  const headerValue = req.headers["x-request-id"];
  const requestId = typeof headerValue === "string" && headerValue ? headerValue : randomUUID();

  return {
    requestId,
    method: req.method ?? "UNKNOWN",
    path: req.url ?? "",
  };
}
