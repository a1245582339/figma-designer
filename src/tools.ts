import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { FigmaClient } from "./client.js";
import { readToolDefs } from "./tool-defs.js";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function getClient(api: OpenClawPluginApi): FigmaClient {
  const cfg = api.pluginConfig as { personalAccessToken?: string } | undefined;
  const token = cfg?.personalAccessToken;
  if (!token)
    throw new Error(
      "Figma personalAccessToken not configured in plugins.entries.figma-designer.config",
    );
  return new FigmaClient({ personalAccessToken: token });
}

export function registerFigmaTools(api: OpenClawPluginApi, filter?: Set<string>) {
  const tools = filter
    ? readToolDefs.filter((t) => filter.has(t.name))
    : readToolDefs;

  for (const tool of tools) {
    api.registerTool(
      {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        async execute(_callId: string, params: Record<string, unknown>) {
          const client = getClient(api);
          const result = await tool.execute(params, { client, bridge: null as any });
          return json(result);
        },
      },
      { name: tool.name },
    );
  }
}
