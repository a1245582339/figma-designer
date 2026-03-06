import { WebSocketServer, type WebSocket } from "ws";
import { execSync } from "child_process";

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

  async start(): Promise<void> {
    try {
      await this.listen();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "EADDRINUSE") {
        console.warn(`[figma-designer] Port ${this.port} already in use, checking for stale process…`);
        if (this.reclaimPort()) {
          await new Promise((r) => setTimeout(r, 500));
          await this.listen();
          return;
        }
      }
      throw err;
    }
  }

  private listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port, host: "0.0.0.0" });
      this.wss.on("listening", () => {
        console.error(`[figma-designer] WebSocket bridge listening on ws://0.0.0.0:${this.port}`);
        resolve();
      });
      this.wss.on("error", reject);
      this.wss.on("connection", (ws) => {
        console.error("[figma-designer] Figma plugin connected");
        this.plugin = ws;
        ws.on("message", (raw) => {
          try {
            const msg = JSON.parse(String(raw));
            if (msg.hello === "from-plugin-ui") return;
            this.handlePluginMessage(msg);
          } catch (err) {
            console.warn("[figma-designer] Failed to parse plugin message:", err);
          }
        });
        ws.on("close", () => {
          console.error("[figma-designer] Figma plugin disconnected");
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

  /**
   * Try to kill a stale figma-designer process occupying our port.
   * Returns true if a process was killed and the port should be free.
   */
  private reclaimPort(): boolean {
    try {
      const output = execSync(`lsof -i :${this.port} -t 2>/dev/null`, {
        encoding: "utf8",
      }).trim();
      if (!output) return false;

      const pids = output
        .split("\n")
        .map((s) => Number(s.trim()))
        .filter((n) => n > 0 && n !== process.pid);

      let killed = false;
      for (const pid of pids) {
        try {
          const cmd = execSync(`ps -p ${pid} -o command= 2>/dev/null`, {
            encoding: "utf8",
          }).trim();
          if (cmd.includes("figma-designer") || cmd.includes("mcp-server")) {
            console.warn(`[figma-designer] Killing stale process (pid ${pid})`);
            process.kill(pid, "SIGTERM");
            killed = true;
          } else {
            console.warn(
              `[figma-designer] Port ${this.port} occupied by unrelated process (pid ${pid}): ${cmd}`,
            );
          }
        } catch {
          // ps failed — process may have already exited
        }
      }
      return killed;
    } catch {
      return false;
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const [id, req] of this.pending) {
        req.reject(new Error("Bridge shutting down"));
        clearTimeout(req.timer);
      }
      this.pending.clear();

      if (this.wss) {
        for (const client of this.wss.clients) {
          client.terminate();
        }
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
      this.wss = null;
      this.plugin = null;
    });
  }

  get isConnected(): boolean {
    return this.plugin !== null && this.plugin.readyState === 1;
  }

  async send(action: string, args: Record<string, unknown> = {}, timeoutMs = 30000): Promise<unknown> {
    if (!this.isConnected) {
      throw new Error(
        "Figma plugin not connected. Open Figma and run the 'AI Figma Designer' plugin, " +
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
