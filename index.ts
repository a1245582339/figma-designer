import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerFigmaTools } from "./src/tools.js";
import { registerFigmaWriteTools } from "./src/write-tools.js";
import { FigmaBridge } from "./src/bridge.js";

let bridge: FigmaBridge | null = null;

function cleanupBridge() {
  if (bridge) {
    bridge.stop();
    bridge = null;
  }
}

process.on("SIGINT", cleanupBridge);
process.on("SIGTERM", cleanupBridge);
process.on("exit", cleanupBridge);

function getPluginConfig(api: OpenClawPluginApi): Record<string, unknown> {
  try {
    return (api.config?.plugins?.entries?.["figma-designer"]?.config as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

const plugin = {
  id: "figma-designer",
  name: "Figma Designer",
  logo: new URL("./figma-plugin/assets/logo.jpeg", import.meta.url).pathname,
  description:
    "Full Figma integration: read designs via REST API, create and modify designs via WebSocket bridge to Figma plugin",
  configSchema: {
    type: "object" as const,
    properties: {
      personalAccessToken: { type: "string" as const, description: "Figma Personal Access Token" },
      bridgePort: { type: "number" as const, description: "WebSocket bridge port (default 3055)" },
    },
  },
  register(api: OpenClawPluginApi) {
    registerFigmaTools(api);

    const cfg = getPluginConfig(api);
    const port = (typeof cfg.bridgePort === "number" ? cfg.bridgePort : 3055);

    if (!bridge) {
      bridge = new FigmaBridge(port);
      bridge.start().catch((err: unknown) => {
        console.error("[figma-designer] Failed to start WebSocket bridge:", err);
      });
    }

    registerFigmaWriteTools(api, bridge);
  },
};

export default plugin;
