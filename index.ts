import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import { registerFigmaTools } from "./src/tools.js";
import { registerFigmaWriteTools } from "./src/write-tools.js";
import { FigmaBridge } from "./src/bridge.js";
import { toolCategories, type ToolCategory } from "./src/tool-registry.js";
import { readToolDefs, writeToolDefs } from "./src/tool-defs.js";

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

const categoryDescriptions: Record<ToolCategory, string> = {
  core: "Read files, screenshot, find/select nodes, list pages, bridge status (always loaded)",
  create: "Create frames, rectangles, ellipses, lines, polygons, stars, text, images, pages",
  modify: "Rename, delete, duplicate, resize, rotate, reposition, group/ungroup, reparent nodes, switch pages",
  style: "Set fill, stroke, corner radius, opacity, blend mode, add/clear effects",
  layout: "Auto layout, constraints, layout grids, page bounds",
  text: "Set text content, text style, text color",
  component: "Create components/instances, detach, boolean ops, get/set component properties, search components",
  export: "Export nodes, batch set properties, list components/styles via REST, comments",
};

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function registerDynamic(api: OpenClawPluginApi, activeBridge: FigmaBridge) {
  const loadedCategories = new Set<ToolCategory>(["core"]);
  const registeredTools = new Set<string>();

  const readToolMap = new Map(readToolDefs.map((t) => [t.name, t]));
  const writeToolMap = new Map(writeToolDefs.map((t) => [t.name, t]));

  function registerToolsForCategory(category: ToolCategory): string[] {
    const names = toolCategories[category] as readonly string[];
    const newlyRegistered: string[] = [];
    for (const name of names) {
      if (registeredTools.has(name)) continue;
      registeredTools.add(name);
      newlyRegistered.push(name);

      const readTool = readToolMap.get(name);
      if (readTool) {
        registerFigmaTools(api, new Set([name]));
        continue;
      }
      const writeTool = writeToolMap.get(name);
      if (writeTool) {
        registerFigmaWriteTools(api, activeBridge, new Set([name]));
      }
    }
    return newlyRegistered;
  }

  // Register core tools
  registerToolsForCategory("core");

  // Register meta-tools
  api.registerTool(
    {
      name: "figma_load_toolset",
      description:
        "Load a group of Figma tools on demand. Available categories:\n" +
        Object.entries(categoryDescriptions)
          .map(([k, v]) => `• ${k}: ${v}`)
          .join("\n") +
        '\nUse category "all" to load everything. Comma-separated for multiple.',
      parameters: Type.Object({
        categories: Type.String({
          description:
            'Comma-separated category names to load (e.g. "create,style") or "all" for everything.',
        }),
      }),
      async execute(_callId: string, params: Record<string, unknown>) {
        const raw = (params.categories as string).trim();
        if (raw === "all") {
          const loaded: string[] = [];
          for (const cat of Object.keys(toolCategories) as ToolCategory[]) {
            if (loadedCategories.has(cat)) continue;
            loadedCategories.add(cat);
            loaded.push(...registerToolsForCategory(cat));
          }
          return json({
            status: "ok",
            loaded_categories: Object.keys(toolCategories),
            newly_registered: loaded,
          });
        }
        const requested = raw.split(",").map((s) => s.trim()) as ToolCategory[];
        const loaded: string[] = [];
        const invalid: string[] = [];
        for (const cat of requested) {
          if (cat in toolCategories) {
            if (!loadedCategories.has(cat)) {
              loadedCategories.add(cat);
              loaded.push(...registerToolsForCategory(cat));
            }
          } else {
            invalid.push(cat);
          }
        }
        return json({
          status: "ok",
          loaded_categories: [...loadedCategories],
          newly_registered: loaded,
          ...(invalid.length ? { invalid_categories: invalid } : {}),
        });
      },
    },
    { name: "figma_load_toolset" },
  );

  api.registerTool(
    {
      name: "figma_list_toolsets",
      description: "List all available tool categories and their load status.",
      parameters: Type.Object({}),
      async execute() {
        const result = Object.entries(categoryDescriptions).map(([cat, desc]) => ({
          category: cat,
          description: desc,
          loaded: loadedCategories.has(cat as ToolCategory),
          tools: toolCategories[cat as ToolCategory],
        }));
        return json(result);
      },
    },
    { name: "figma_list_toolsets" },
  );
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
      dynamicTools: { type: "boolean" as const, description: "Enable on-demand tool loading to save tokens (default false)" },
    },
  },
  register(api: OpenClawPluginApi) {
    const cfg = getPluginConfig(api);
    const port = (typeof cfg.bridgePort === "number" ? cfg.bridgePort : 3055);
    const dynamicMode = cfg.dynamicTools === true || process.env.FIGMA_DYNAMIC_TOOLS === "1";

    if (!bridge) {
      bridge = new FigmaBridge(port);
      bridge.start().catch((err: unknown) => {
        console.error("[figma-designer] Failed to start WebSocket bridge:", err);
      });
    }

    if (dynamicMode) {
      registerDynamic(api, bridge);
    } else {
      registerFigmaTools(api);
      registerFigmaWriteTools(api, bridge);
    }
  },
};

export default plugin;
