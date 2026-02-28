import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerFigmaTools } from "./src/tools.js";

const plugin = {
  id: "figma-designer",
  name: "Figma Designer",
  description: "Figma integration for reading designs, exporting images, listing components/styles, and posting comments",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    registerFigmaTools(api);
  },
};

export default plugin;
