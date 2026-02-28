import { WebSocketServer, type WebSocket } from "ws";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class FigmaBridge {
  private wss: WebSocketServer | null = null;
  private plugin: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private idCounter = 0;
  private port: number;

  constructor(port = 3055) {
    this.port = port;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port, host: "0.0.0.0" });
      this.wss.on("listening", () => {
        console.log(`[figma-designer] WebSocket bridge listening on ws://0.0.0.0:${this.port}`);
        resolve();
      });
      this.wss.on("error", reject);
      this.wss.on("connection", (ws) => {
        console.log("[figma-designer] Figma plugin connected");
        this.plugin = ws;
        ws.on("message", (raw) => {
          try {
            const msg = JSON.parse(String(raw));
            if (msg.hello === "from-plugin-ui") return;
            this.handlePluginMessage(msg);
          } catch {}
        });
        ws.on("close", () => {
          console.log("[figma-designer] Figma plugin disconnected");
          if (this.plugin === ws) this.plugin = null;
          for (const [id, req] of this.pending) {
            req.reject(new Error("Figma plugin disconnected"));
            clearTimeout(req.timer);
            this.pending.delete(id);
          }
        });
      });
    });
  }

  stop() {
    this.wss?.close();
    this.wss = null;
    this.plugin = null;
  }

  get isConnected(): boolean {
    return this.plugin !== null && this.plugin.readyState === 1;
  }

  async send(action: string, args: Record<string, unknown> = {}, timeoutMs = 30000): Promise<unknown> {
    if (!this.isConnected) {
      throw new Error(
        "Figma plugin not connected. Open Figma and run the 'OpenClaw Figma Bridge' plugin, " +
        `then ensure it connects to ws://<server-ip>:${this.port}`
      );
    }
    const id = `req_${++this.idCounter}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Figma action '${action}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.plugin!.send(JSON.stringify({ id, action, args }));
    });
  }

  private handlePluginMessage(msg: { replyTo?: string; result?: unknown; error?: string }) {
    if (!msg.replyTo) return;
    const req = this.pending.get(msg.replyTo);
    if (!req) return;
    this.pending.delete(msg.replyTo);
    clearTimeout(req.timer);
    if (msg.error) {
      req.reject(new Error(msg.error));
    } else {
      req.resolve(msg.result);
    }
  }
}
