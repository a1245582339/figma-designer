import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerFigmaTools } from "./src/tools.js";
import { registerFigmaWriteTools } from "./src/write-tools.js";
import { FigmaBridge } from "./src/bridge.js";

let bridge: FigmaBridge | null = null;

const plugin = {
  id: "figma-designer",
  name: "Figma Designer",
  description:
    "Full Figma integration: read designs via REST API, create and modify designs via WebSocket bridge to Figma plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    registerFigmaTools(api);

    const cfg = api.config.plugins?.entries?.["figma-designer"]?.config as
      | { bridgePort?: number }
      | undefined;
    const port = cfg?.bridgePort ?? 3055;

    bridge = new FigmaBridge(port);
    bridge.start().catch((err) => {
      console.error("[figma-designer] Failed to start WebSocket bridge:", err);
    });

    registerFigmaWriteTools(api, bridge);
  },
};

export default plugin;
