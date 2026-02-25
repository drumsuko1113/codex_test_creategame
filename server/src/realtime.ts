import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

type ClientInfo = {
  gameId: string;
};

export class RealtimeHub {
  private readonly wsServer = new WebSocketServer({ noServer: true });
  private readonly clients = new Map<WebSocket, ClientInfo>();

  attach(server: Server): void {
    server.on("upgrade", (req, socket, head) => {
      const gameId = this.extractGameId(req);
      if (!gameId) {
        socket.destroy();
        return;
      }

      this.wsServer.handleUpgrade(req, socket, head, (ws) => {
        this.clients.set(ws, { gameId });
        ws.on("close", () => {
          this.clients.delete(ws);
        });
      });
    });
  }

  broadcast(gameId: string, type: string, payload: unknown): void {
    const data = JSON.stringify({ type, payload });
    for (const [client, info] of this.clients.entries()) {
      if (info.gameId !== gameId || client.readyState !== client.OPEN) {
        continue;
      }
      client.send(data);
    }
  }

  private extractGameId(req: IncomingMessage): string | null {
    const match = req.url?.match(/^\/api\/games\/([^/]+)\/events$/);
    return match ? match[1] : null;
  }
}
