import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { FigmaClient } from "./src/client.js";
import { FigmaBridge } from "./src/bridge.js";
import { allToolDefs, type ToolContext } from "./src/tool-defs.js";

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error("Error: FIGMA_TOKEN environment variable is required.");
  console.error("Generate one at https://www.figma.com/developers/api#access-tokens");
  process.exit(1);
}

const bridgePort = Number(process.env.FIGMA_BRIDGE_PORT) || 3055;
const client = new FigmaClient({ personalAccessToken: token });
const bridge = new FigmaBridge(bridgePort);

const ctx: ToolContext = { client, bridge };

const server = new Server(
  { name: "figma-designer", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allToolDefs.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: JSON.parse(JSON.stringify(t.parameters)),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = allToolDefs.find((t) => t.name === name);
  if (!tool) {
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    const result = await tool.execute(args ?? {}, ctx);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [
        { type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ],
      isError: true,
    };
  }
});

async function main() {
  await bridge.start();
  console.error(`[figma-designer] MCP server starting (bridge port ${bridgePort})`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[figma-designer] MCP server connected via stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
