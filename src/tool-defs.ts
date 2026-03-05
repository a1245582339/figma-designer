import { Type, type TSchema } from "@sinclair/typebox";
import type { FigmaClient, FigmaNode } from "./client.js";
import type { FigmaBridge } from "./bridge.js";

export interface ToolContext {
  client: FigmaClient;
  bridge: FigmaBridge;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: TSchema;
  execute: (params: any, ctx: ToolContext) => Promise<unknown>;
}

// ── Schema helpers ──

const Opt = Type.Optional;
const Str = (d?: string) => (d ? Type.String({ description: d }) : Type.String());
const Num = (d?: string) => (d ? Type.Number({ description: d }) : Type.Number());
const OptStr = (d?: string) => Opt(Str(d));
const OptNum = (d?: string) => Opt(Num(d));
const NodeId = Str("Target node ID");
const ParentId = OptStr("Parent node ID. Omit to add to current page.");
const Hex = OptStr("Hex color (e.g. '#FF6600')");

// ── Read helpers ──

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

// ── Bridge tool shorthand ──

function bt(name: string, description: string, parameters: TSchema, action: string): ToolDef {
  return {
    name,
    description,
    parameters,
    execute: async (params, { bridge }) => bridge.send(action, params),
  };
}

// ============ Read Tool Definitions ============

export const readToolDefs: ToolDef[] = [
  {
    name: "figma_read",
    description:
      "Read a Figma file or specific nodes. Returns node tree with layout, style, and text info. " +
      "Use fileKey from Figma URL: figma.com/design/:fileKey/... " +
      "Optionally specify nodeIds to read specific nodes instead of the whole file.",
    parameters: Type.Object({
      fileKey: Type.String({ description: "Figma file key (from URL)" }),
      nodeIds: Type.Optional(
        Type.Array(Type.String(), {
          description: "Specific node IDs to read (e.g. ['1:2', '3:4']). Omit to read entire file.",
        }),
      ),
      depth: Type.Optional(
        Type.Number({ description: "Max depth of node tree to return (default 3)" }),
      ),
    }),
    async execute(params: { fileKey: string; nodeIds?: string[]; depth?: number }, { client }) {
      const depth = params.depth ?? 3;
      if (params.nodeIds?.length) {
        const resp = await client.getFileNodes(params.fileKey, params.nodeIds);
        const result: Record<string, unknown> = {};
        for (const [id, node] of Object.entries(resp.nodes)) {
          result[id] = node ? summarizeNode(node.document, 0, depth) : null;
        }
        return result;
      }
      const resp = await client.getFile(params.fileKey, { depth: Math.min(depth, 2) });
      return {
        name: resp.name,
        lastModified: resp.lastModified,
        document: summarizeNode(resp.document, 0, depth),
        componentCount: Object.keys(resp.components).length,
        styleCount: Object.keys(resp.styles).length,
      };
    },
  },
  {
    name: "figma_screenshot",
    description:
      "Export Figma nodes as images. Returns download URLs for the exported images. Supports png, jpg, svg, pdf formats.",
    parameters: Type.Object({
      fileKey: Type.String({ description: "Figma file key" }),
      nodeIds: Type.Array(Type.String(), { description: "Node IDs to export (e.g. ['1:2'])" }),
      format: Type.Optional(
        Type.Union(
          [Type.Literal("png"), Type.Literal("jpg"), Type.Literal("svg"), Type.Literal("pdf")],
          { description: "Image format (default: png)" },
        ),
      ),
      scale: Type.Optional(Type.Number({ description: "Export scale (default: 2)" })),
    }),
    async execute(
      params: { fileKey: string; nodeIds: string | string[]; format?: string; scale?: number },
      { client },
    ) {
      const ids = Array.isArray(params.nodeIds)
        ? params.nodeIds
        : typeof params.nodeIds === "string"
          ? params.nodeIds.split(",").map((s: string) => s.trim())
          : [];
      if (ids.length === 0) throw new Error("nodeIds is required (e.g. [\"1:2\"])");
      const resp = await client.getImages(params.fileKey, ids, {
        format: (params.format ?? "png") as any,
        scale: params.scale ?? 2,
      });
      return resp.images;
    },
  },
  {
    name: "figma_components",
    description:
      "List all components in a Figma file. Returns component names, descriptions, and node IDs.",
    parameters: Type.Object({
      fileKey: Type.String({ description: "Figma file key" }),
    }),
    async execute(params: { fileKey: string }, { client }) {
      const resp = await client.getFileComponents(params.fileKey);
      return resp.meta.components.map((c) => ({
        name: c.name,
        description: c.description,
        key: c.key,
        nodeId: c.node_id,
        containingFrame: c.containing_frame?.name,
      }));
    },
  },
  {
    name: "figma_styles",
    description: "List all styles (colors, text styles, effects, grids) in a Figma file.",
    parameters: Type.Object({
      fileKey: Type.String({ description: "Figma file key" }),
    }),
    async execute(params: { fileKey: string }, { client }) {
      const resp = await client.getFileStyles(params.fileKey);
      return resp.meta.styles.map((s) => ({
        name: s.name,
        type: s.style_type,
        description: s.description,
        key: s.key,
        nodeId: s.node_id,
      }));
    },
  },
  {
    name: "figma_comment",
    description:
      "Post a comment on a Figma file. Optionally attach to a specific node. Useful for design review feedback.",
    parameters: Type.Object({
      fileKey: Type.String({ description: "Figma file key" }),
      message: Type.String({ description: "Comment text" }),
      nodeId: Type.Optional(Type.String({ description: "Node ID to attach the comment to" })),
    }),
    async execute(params: { fileKey: string; message: string; nodeId?: string }, { client }) {
      const resp = await client.postComment(params.fileKey, params.message, {
        nodeId: params.nodeId,
      });
      return { id: resp.id, message: resp.message, createdAt: resp.created_at };
    },
  },
  {
    name: "figma_get_comments",
    description:
      "Read all comments on a Figma file. Returns comment text, author, timestamp, and attached node ID if any.",
    parameters: Type.Object({
      fileKey: Type.String({ description: "Figma file key (from URL)" }),
    }),
    async execute(params: { fileKey: string }, { client }) {
      const resp = await client.getComments(params.fileKey);
      return resp.comments.map((c) => ({
        id: c.id,
        message: c.message,
        author: c.user.handle,
        createdAt: c.created_at,
        orderId: c.order_id,
      }));
    },
  },
];

// ============ Write Tool Definitions ============

export const writeToolDefs: ToolDef[] = [
  // ── Create ──
  bt(
    "figma_create_frame",
    "Create a new frame in Figma (like an artboard).",
    Type.Object({
      name: OptStr("Frame name (default: 'Frame')"),
      width: OptNum("Width in px (default: 800)"),
      height: OptNum("Height in px (default: 600)"),
      x: OptNum(),
      y: OptNum(),
      parentId: ParentId,
    }),
    "create_frame",
  ),
  bt(
    "figma_create_rectangle",
    "Create a rectangle in Figma.",
    Type.Object({
      width: Num("Width in px"),
      height: Num("Height in px"),
      x: OptNum(),
      y: OptNum(),
      cornerRadius: OptNum("Corner radius"),
      hex: Hex,
      parentId: ParentId,
    }),
    "create_rectangle",
  ),
  bt(
    "figma_create_ellipse",
    "Create an ellipse / circle in Figma.",
    Type.Object({
      width: Num(),
      height: Num(),
      x: OptNum(),
      y: OptNum(),
      hex: Hex,
      parentId: ParentId,
    }),
    "create_ellipse",
  ),
  bt(
    "figma_create_line",
    "Create a line in Figma.",
    Type.Object({
      length: Num("Line length in px"),
      x: OptNum(),
      y: OptNum(),
      rotation: OptNum("Rotation in degrees"),
      strokeHex: OptStr("Stroke color hex"),
      strokeWeight: OptNum("Stroke weight"),
      parentId: ParentId,
    }),
    "create_line",
  ),
  bt(
    "figma_create_polygon",
    "Create a polygon in Figma.",
    Type.Object({
      sides: Num("Number of sides"),
      width: Num(),
      height: Num(),
      x: OptNum(),
      y: OptNum(),
      hex: Hex,
      parentId: ParentId,
    }),
    "create_polygon",
  ),
  bt(
    "figma_create_star",
    "Create a star shape in Figma.",
    Type.Object({
      points: Num("Number of star points"),
      width: Num(),
      height: Num(),
      x: OptNum(),
      y: OptNum(),
      hex: Hex,
      parentId: ParentId,
    }),
    "create_star",
  ),
  bt(
    "figma_add_text",
    "Add a text node in Figma.",
    Type.Object({
      text: Str("Text content"),
      x: OptNum(),
      y: OptNum(),
      fontFamily: OptStr("Font family (default: 'Inter')"),
      fontStyle: OptStr("Font style (default: 'Regular')"),
      fontSize: OptNum("Font size (default: 32)"),
      hex: Hex,
      parentId: ParentId,
    }),
    "add_text",
  ),
  bt(
    "figma_place_image",
    "Place an image in Figma from base64-encoded data.",
    Type.Object({
      base64: Str("Base64-encoded image data"),
      width: Num(),
      height: Num(),
      x: OptNum(),
      y: OptNum(),
      parentId: ParentId,
    }),
    "place_image_base64",
  ),

  // ── Find / Select ──
  bt(
    "figma_find_nodes",
    "Find nodes in the current Figma page by type or name.",
    Type.Object({
      type: OptStr("Node type filter (FRAME, RECTANGLE, TEXT, etc.)"),
      nameContains: OptStr("Case-insensitive name substring"),
      within: OptStr("Search within this node ID"),
    }),
    "find_nodes",
  ),
  bt(
    "figma_select_nodes",
    "Select specific nodes in Figma.",
    Type.Object({
      nodeIds: Type.Array(Str(), { description: "Node IDs to select" }),
    }),
    "select_nodes",
  ),
  bt("figma_get_selection", "Get currently selected nodes in Figma.", Type.Object({}), "get_selection"),

  // ── Page ──
  bt(
    "figma_create_page",
    "Create a new page in the Figma file.",
    Type.Object({
      name: OptStr("Page name"),
      makeCurrent: Opt(Type.Boolean({ description: "Switch to this page (default: true)" })),
    }),
    "create_page",
  ),
  bt(
    "figma_set_current_page",
    "Switch to a different page.",
    Type.Object({ pageId: Str("Page node ID") }),
    "set_current_page",
  ),

  // ── Node management ──
  bt("figma_rename_node", "Rename a node.", Type.Object({ nodeId: NodeId, name: Str("New name") }), "rename_node"),
  bt("figma_delete_node", "Delete a node.", Type.Object({ nodeId: NodeId }), "delete_node"),
  bt("figma_duplicate_node", "Duplicate a node.", Type.Object({ nodeId: NodeId, x: OptNum(), y: OptNum() }), "duplicate_node"),
  bt("figma_resize_node", "Resize a node.", Type.Object({ nodeId: NodeId, width: Num(), height: Num() }), "resize_node"),
  bt("figma_rotate_node", "Rotate a node.", Type.Object({ nodeId: NodeId, rotation: Num("Rotation in degrees") }), "rotate_node"),
  bt("figma_set_position", "Set absolute position of a node.", Type.Object({ nodeId: NodeId, x: Num(), y: Num() }), "set_position"),
  bt(
    "figma_group_nodes",
    "Group multiple nodes.",
    Type.Object({
      nodeIds: Type.Array(Str(), { description: "Node IDs to group (need 2+)" }),
      name: OptStr("Group name"),
    }),
    "group_nodes",
  ),
  bt("figma_ungroup", "Ungroup a group node.", Type.Object({ groupId: Str("Group node ID") }), "ungroup"),
  bt(
    "figma_reparent_node",
    "Move a node into a different container (frame, group, page). Useful for rearranging the layer hierarchy.",
    Type.Object({
      nodeId: NodeId,
      newParentId: OptStr("Target container node ID. Omit to move to current page root."),
      index: OptNum("Insert position among siblings (0 = first). Omit to append at the end."),
    }),
    "reparent_node",
  ),

  // ── Styling ──
  bt(
    "figma_set_fill",
    "Set the fill color of a node.",
    Type.Object({ nodeId: NodeId, hex: Str("Fill color hex"), opacity: OptNum("Opacity 0-1") }),
    "set_fill",
  ),
  bt(
    "figma_set_stroke",
    "Set the stroke of a node.",
    Type.Object({
      nodeId: NodeId,
      hex: Str("Stroke color hex"),
      opacity: OptNum(),
      strokeWeight: OptNum(),
      strokeAlign: OptStr("INSIDE | OUTSIDE | CENTER"),
      dashPattern: Opt(Type.Array(Num())),
      cap: OptStr(),
      join: OptStr(),
    }),
    "set_stroke",
  ),
  bt(
    "figma_set_corner_radius",
    "Set corner radius of a node.",
    Type.Object({
      nodeId: NodeId,
      radius: OptNum("Uniform corner radius"),
      topLeft: OptNum(),
      topRight: OptNum(),
      bottomRight: OptNum(),
      bottomLeft: OptNum(),
    }),
    "set_corner_radius",
  ),
  bt("figma_set_opacity", "Set opacity (0-1).", Type.Object({ nodeId: NodeId, opacity: Num("Opacity 0-1") }), "set_opacity"),
  bt("figma_set_blend_mode", "Set blend mode.", Type.Object({ nodeId: NodeId, mode: Str("NORMAL, MULTIPLY, SCREEN, etc.") }), "set_blend_mode"),
  bt(
    "figma_add_effect",
    "Add a visual effect (shadow, blur).",
    Type.Object({
      nodeId: NodeId,
      type: Str("DROP_SHADOW | INNER_SHADOW | LAYER_BLUR | BACKGROUND_BLUR"),
      radius: OptNum("Blur radius (default: 8)"),
      spread: OptNum(),
      hex: OptStr("Shadow color hex"),
      opacity: OptNum(),
      offsetX: OptNum(),
      offsetY: OptNum(),
    }),
    "add_effect",
  ),
  bt("figma_clear_effects", "Remove all effects.", Type.Object({ nodeId: NodeId }), "clear_effects"),

  // ── Auto Layout ──
  bt(
    "figma_set_auto_layout",
    "Configure Auto Layout on a frame.",
    Type.Object({
      nodeId: NodeId,
      layoutMode: OptStr("HORIZONTAL | VERTICAL | NONE"),
      primaryAxisSizingMode: OptStr("FIXED | AUTO"),
      counterAxisSizingMode: OptStr("FIXED | AUTO"),
      itemSpacing: OptNum(),
      paddingTop: OptNum(),
      paddingRight: OptNum(),
      paddingBottom: OptNum(),
      paddingLeft: OptNum(),
      primaryAxisAlignItems: OptStr("MIN | CENTER | MAX | SPACE_BETWEEN"),
      counterAxisAlignItems: OptStr("MIN | CENTER | MAX"),
      layoutWrap: OptStr("NO_WRAP | WRAP"),
      counterAxisSpacing: OptNum(),
    }),
    "set_auto_layout",
  ),
  bt(
    "figma_set_constraints",
    "Set layout constraints.",
    Type.Object({
      nodeId: NodeId,
      horizontal: OptStr("MIN | CENTER | MAX | STRETCH | SCALE"),
      vertical: OptStr("MIN | CENTER | MAX | STRETCH | SCALE"),
    }),
    "set_constraints",
  ),

  // ── Text ──
  bt("figma_set_text_content", "Change text content.", Type.Object({ nodeId: NodeId, text: Str("New text") }), "set_text_content"),
  bt(
    "figma_set_text_style",
    "Apply text styling.",
    Type.Object({
      nodeId: NodeId,
      fontFamily: OptStr(),
      fontStyle: OptStr(),
      fontSize: OptNum(),
      lineHeight: OptNum(),
      letterSpacing: OptNum(),
      textAlignHorizontal: OptStr("LEFT | CENTER | RIGHT | JUSTIFIED"),
      textAutoResize: OptStr("NONE | WIDTH_AND_HEIGHT | HEIGHT"),
    }),
    "set_text_style",
  ),
  bt(
    "figma_set_text_color",
    "Set text color.",
    Type.Object({ nodeId: NodeId, hex: Str("Text color hex"), opacity: OptNum() }),
    "set_text_color",
  ),

  // ── Components & Boolean ──
  bt(
    "figma_create_component",
    "Create a reusable component.",
    Type.Object({
      name: OptStr("Component name"),
      fromNodeIds: Opt(Type.Array(Str(), { description: "Node IDs to move into component" })),
    }),
    "create_component",
  ),
  bt(
    "figma_create_instance",
    "Instantiate a component. Use this to reuse existing AntD or library components found via figma_search_components.",
    Type.Object({
      componentId: Str("Component node ID"),
      x: OptNum(),
      y: OptNum(),
      parentId: ParentId,
    }),
    "create_instance",
  ),
  bt("figma_detach_instance", "Detach a component instance.", Type.Object({ nodeId: NodeId }), "detach_instance"),
  bt(
    "figma_boolean_op",
    "Boolean operation on vector nodes.",
    Type.Object({
      op: Str("UNION | SUBTRACT | INTERSECT | EXCLUDE"),
      nodeIds: Type.Array(Str(), { description: "Node IDs to combine (2+)" }),
      name: OptStr(),
    }),
    "boolean_op",
  ),

  // ── Layout Grid ──
  bt(
    "figma_layout_grid_add",
    "Add a layout grid to a frame.",
    Type.Object({
      nodeId: NodeId,
      pattern: OptStr("COLUMNS | ROWS | GRID"),
      count: OptNum("Number of columns/rows"),
      gutterSize: OptNum(),
      sectionSize: OptNum(),
      hex: Hex,
      opacity: OptNum(),
    }),
    "layout_grid_add",
  ),
  bt("figma_layout_grid_clear", "Remove all layout grids.", Type.Object({ nodeId: NodeId }), "layout_grid_clear"),

  // ── Export / Batch ──
  bt(
    "figma_export_node",
    "Export a node as PNG, JPG, or SVG via the plugin.",
    Type.Object({
      nodeId: NodeId,
      format: OptStr("PNG | JPG | SVG"),
      scale: OptNum("Export scale (default: 1)"),
    }),
    "export_node",
  ),
  bt(
    "figma_set_properties",
    "Batch-set multiple properties on a node.",
    Type.Object({
      nodeId: NodeId,
      props: Type.Record(Type.String(), Type.Unknown(), {
        description: "Key-value pairs of properties",
      }),
    }),
    "set_properties",
  ),

  // ── Component Properties ──
  bt(
    "figma_get_component_properties",
    "Read all configurable properties (variants, booleans, text overrides) of a component instance or component. Returns property names, types, current values, and available options. Use this after creating an instance to see what can be configured.",
    Type.Object({ nodeId: NodeId }),
    "get_component_properties",
  ),
  bt(
    "figma_set_component_properties",
    "Set variant properties on a component instance. Use this to configure components like Table (Rows, Columns), Button (Type, Size, Danger), Input (Status), etc. Property names are case-insensitive and support fuzzy matching.",
    Type.Object({
      nodeId: NodeId,
      properties: Type.Record(Type.String(), Type.Unknown(), {
        description:
          "Key-value pairs of component properties to set (e.g. { 'Rows': '8', 'Columns': '5', 'Type': 'Primary' })",
      }),
    }),
    "set_component_properties",
  ),

  // ── Component Library ──
  bt(
    "figma_list_local_components",
    "List all components in the Figma file. Use pageFilter to narrow to a specific page. Returns component name, ID, variant properties, and page location. Use this to discover available AntD components before creating instances.",
    Type.Object({
      pageFilter: Opt(Str("Only list components from this page name (case-insensitive)")),
      limit: Opt(Num("Max results (default: 200)")),
    }),
    "list_local_components",
  ),
  bt(
    "figma_search_components",
    "Search for components by name, component set name, or description. Returns matching components with their IDs and properties. Use this to find specific AntD components like 'Button', 'Input', 'Table', etc.",
    Type.Object({
      query: Str("Search term (e.g. 'Button', 'Input', 'Table')"),
      limit: Opt(Num("Max results (default: 50)")),
    }),
    "search_components",
  ),
  bt(
    "figma_list_pages",
    "List all pages in the Figma file with their IDs and names, and show which page is currently active.",
    Type.Object({}),
    "list_pages",
  ),
  bt(
    "figma_get_page_bounds",
    "Get the bounding box of all top-level content on the current page, plus a suggested position for placing new elements without overlap. Also lists all top-level nodes with their positions and sizes.",
    Type.Object({}),
    "get_page_bounds",
  ),
  bt(
    "figma_find_nodes_all_pages",
    "Search for nodes across ALL pages in the Figma file by type and/or name. Unlike figma_find_nodes which only searches the current page, this scans every page. Returns node ID, type, name, and which page it belongs to.",
    Type.Object({
      type: OptStr("Node type filter (FRAME, RECTANGLE, TEXT, COMPONENT, INSTANCE, GROUP, etc.)"),
      nameContains: OptStr("Case-insensitive name substring match"),
      nameEquals: OptStr("Exact name match (takes priority over nameContains)"),
      limit: Opt(Num("Max results (default: 500)")),
    }),
    "find_nodes_all_pages",
  ),

  // ── Bridge status ──
  {
    name: "figma_bridge_status",
    description: "Check if the Figma plugin is connected to the bridge.",
    parameters: Type.Object({}),
    execute: async (_params, { bridge }) => ({ connected: bridge.isConnected }),
  },
];

export const allToolDefs: ToolDef[] = [...readToolDefs, ...writeToolDefs];
