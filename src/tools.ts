import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { FigmaClient, type FigmaNode } from "./client.js";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

function getClient(api: OpenClawPluginApi): FigmaClient {
  const cfg = api.config.plugins?.entries?.["figma-designer"]?.config as
    | { personalAccessToken?: string }
    | undefined;
  const token = cfg?.personalAccessToken;
  if (!token) throw new Error("Figma personalAccessToken not configured in plugins.entries.figma-designer.config");
  return new FigmaClient({ personalAccessToken: token });
}

function summarizeNode(node: FigmaNode, depth = 0, maxDepth = 3): unknown {
  const summary: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };
  if (node.absoluteBoundingBox) summary.bounds = node.absoluteBoundingBox;
  if (node.fills) summary.fills = node.fills;
  if (node.strokes) summary.strokes = node.strokes;
  if (node.style) summary.style = node.style;
  if (node.characters) summary.characters = node.characters;
  if (node.componentId) summary.componentId = node.componentId;
  if (node.layoutMode) summary.layoutMode = node.layoutMode;
  if (node.itemSpacing != null) summary.itemSpacing = node.itemSpacing;
  if (node.paddingLeft != null) {
    summary.padding = {
      top: node.paddingTop,
      right: node.paddingRight,
      bottom: node.paddingBottom,
      left: node.paddingLeft,
    };
  }

  if (node.children && depth < maxDepth) {
    summary.children = node.children.map((c) => summarizeNode(c, depth + 1, maxDepth));
  } else if (node.children) {
    summary.childCount = node.children.length;
  }
  return summary;
}

export function registerFigmaTools(api: OpenClawPluginApi) {
  // ── figma_read ──
  api.registerTool(
    "figma_read",
    {
      description:
        "Read a Figma file or specific nodes. Returns node tree with layout, style, and text info. " +
        "Use fileKey from Figma URL: figma.com/design/:fileKey/... " +
        "Optionally specify nodeIds to read specific nodes instead of the whole file.",
      parameters: Type.Object({
        fileKey: Type.String({ description: "Figma file key (from URL)" }),
        nodeIds: Type.Optional(
          Type.Array(Type.String(), { description: "Specific node IDs to read (e.g. ['1:2', '3:4']). Omit to read entire file." })
        ),
        depth: Type.Optional(Type.Number({ description: "Max depth of node tree to return (default 3)" })),
      }),
    },
    async (params) => {
      const client = getClient(api);
      const depth = params.depth ?? 3;

      if (params.nodeIds?.length) {
        const resp = await client.getFileNodes(params.fileKey, params.nodeIds);
        const result: Record<string, unknown> = {};
        for (const [id, node] of Object.entries(resp.nodes)) {
          result[id] = node ? summarizeNode(node.document, 0, depth) : null;
        }
        return json(result);
      }

      const resp = await client.getFile(params.fileKey, { depth: Math.min(depth, 2) });
      return json({
        name: resp.name,
        lastModified: resp.lastModified,
        document: summarizeNode(resp.document, 0, depth),
        componentCount: Object.keys(resp.components).length,
        styleCount: Object.keys(resp.styles).length,
      });
    }
  );

  // ── figma_screenshot ──
  api.registerTool(
    "figma_screenshot",
    {
      description:
        "Export Figma nodes as images. Returns download URLs for the exported images. " +
        "Supports png, jpg, svg, pdf formats.",
      parameters: Type.Object({
        fileKey: Type.String({ description: "Figma file key" }),
        nodeIds: Type.Array(Type.String(), { description: "Node IDs to export (e.g. ['1:2'])" }),
        format: Type.Optional(Type.Union([
          Type.Literal("png"),
          Type.Literal("jpg"),
          Type.Literal("svg"),
          Type.Literal("pdf"),
        ], { description: "Image format (default: png)" })),
        scale: Type.Optional(Type.Number({ description: "Export scale (default: 2)" })),
      }),
    },
    async (params) => {
      const client = getClient(api);
      const resp = await client.getImages(params.fileKey, params.nodeIds, {
        format: params.format ?? "png",
        scale: params.scale ?? 2,
      });
      return json(resp.images);
    }
  );

  // ── figma_components ──
  api.registerTool(
    "figma_components",
    {
      description: "List all components in a Figma file. Returns component names, descriptions, and node IDs.",
      parameters: Type.Object({
        fileKey: Type.String({ description: "Figma file key" }),
      }),
    },
    async (params) => {
      const client = getClient(api);
      const resp = await client.getFileComponents(params.fileKey);
      return json(
        resp.meta.components.map((c) => ({
          name: c.name,
          description: c.description,
          key: c.key,
          nodeId: c.node_id,
          containingFrame: c.containing_frame?.name,
        }))
      );
    }
  );

  // ── figma_styles ──
  api.registerTool(
    "figma_styles",
    {
      description: "List all styles (colors, text styles, effects, grids) in a Figma file.",
      parameters: Type.Object({
        fileKey: Type.String({ description: "Figma file key" }),
      }),
    },
    async (params) => {
      const client = getClient(api);
      const resp = await client.getFileStyles(params.fileKey);
      return json(
        resp.meta.styles.map((s) => ({
          name: s.name,
          type: s.style_type,
          description: s.description,
          key: s.key,
          nodeId: s.node_id,
        }))
      );
    }
  );

  // ── figma_comment ──
  api.registerTool(
    "figma_comment",
    {
      description:
        "Post a comment on a Figma file. Optionally attach to a specific node. " +
        "Useful for design review feedback.",
      parameters: Type.Object({
        fileKey: Type.String({ description: "Figma file key" }),
        message: Type.String({ description: "Comment text" }),
        nodeId: Type.Optional(Type.String({ description: "Node ID to attach the comment to" })),
      }),
    },
    async (params) => {
      const client = getClient(api);
      const resp = await client.postComment(params.fileKey, params.message, {
        nodeId: params.nodeId,
      });
      return json({ id: resp.id, message: resp.message, createdAt: resp.created_at });
    }
  );
}
