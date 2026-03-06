import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { FigmaClient } from "./src/client.js";
import { FigmaBridge } from "./src/bridge.js";
import { type ToolContext } from "./src/tool-defs.js";
import { ToolRegistry } from "./src/tool-registry.js";

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

const mcpServer = new McpServer(
  { name: "figma-designer", version: "0.3.1" },
  { capabilities: { tools: { listChanged: true } } },
);

const registry = new ToolRegistry(() => {
  mcpServer.sendToolListChanged();
});

mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: registry.getActiveTools().map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: JSON.parse(JSON.stringify(t.parameters)),
  })),
}));

mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = registry.findTool(name);

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

async function shutdown() {
  console.error("[figma-designer] Shutting down…");
  await bridge.stop();
  await mcpServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  await bridge.start();
  console.error(`[figma-designer] MCP server starting (bridge port ${bridgePort}, dynamic tools)`);
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error("[figma-designer] MCP server connected via stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
