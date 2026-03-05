import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { FigmaBridge } from "./bridge.js";
import { writeToolDefs } from "./tool-defs.js";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerFigmaWriteTools(api: OpenClawPluginApi, bridge: FigmaBridge) {
  for (const tool of writeToolDefs) {
    api.registerTool(
      {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        async execute(_callId: string, params: Record<string, unknown>) {
          const result = await tool.execute(params, { client: null as any, bridge });
          return json(result);
        },
      },
      { name: tool.name },
    );
  }
}
