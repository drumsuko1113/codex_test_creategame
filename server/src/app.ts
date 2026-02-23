import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === "GET" && req.url === "/health") {
    writeJson(res, 200, { ok: true });
    return;
  }

  writeJson(res, 404, { error: "Not Found" });
}

export function createApp() {
  return createServer(handleRequest);
}
