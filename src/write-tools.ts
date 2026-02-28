import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { FigmaBridge } from "./bridge.js";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

const NodeIdParam = Type.String({ description: "Target node ID" });
const ParentIdParam = Type.Optional(Type.String({ description: "Parent node ID. Omit to add to current page." }));
const HexParam = Type.Optional(Type.String({ description: "Hex color (e.g. '#FF6600')" }));

export function registerFigmaWriteTools(api: OpenClawPluginApi, bridge: FigmaBridge) {
  async function exec(action: string, args: Record<string, unknown> = {}) {
    return await bridge.send(action, args);
  }

  // ── Create ──

  api.registerTool("figma_create_frame", {
    description: "Create a new frame in Figma. Frames are the basic container for designs (like artboards).",
    parameters: Type.Object({
      name: Type.Optional(Type.String({ description: "Frame name (default: 'Frame')" })),
      width: Type.Optional(Type.Number({ description: "Width in pixels (default: 800)" })),
      height: Type.Optional(Type.Number({ description: "Height in pixels (default: 600)" })),
      x: Type.Optional(Type.Number({ description: "X position" })),
      y: Type.Optional(Type.Number({ description: "Y position" })),
      parentId: ParentIdParam,
    }),
  }, async (p) => json(await exec("create_frame", p)));

  api.registerTool("figma_create_rectangle", {
    description: "Create a rectangle in Figma.",
    parameters: Type.Object({
      width: Type.Number({ description: "Width in pixels" }),
      height: Type.Number({ description: "Height in pixels" }),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
      cornerRadius: Type.Optional(Type.Number({ description: "Corner radius" })),
      hex: HexParam,
      parentId: ParentIdParam,
    }),
  }, async (p) => json(await exec("create_rectangle", p)));

  api.registerTool("figma_create_ellipse", {
    description: "Create an ellipse / circle in Figma.",
    parameters: Type.Object({
      width: Type.Number(),
      height: Type.Number(),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
      hex: HexParam,
      parentId: ParentIdParam,
    }),
  }, async (p) => json(await exec("create_ellipse", p)));

  api.registerTool("figma_create_line", {
    description: "Create a line in Figma.",
    parameters: Type.Object({
      length: Type.Number({ description: "Line length in pixels" }),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
      rotation: Type.Optional(Type.Number({ description: "Rotation in degrees" })),
      strokeHex: Type.Optional(Type.String({ description: "Stroke color hex (default: '#111827')" })),
      strokeWeight: Type.Optional(Type.Number({ description: "Stroke weight (default: 1)" })),
      parentId: ParentIdParam,
    }),
  }, async (p) => json(await exec("create_line", p)));

  api.registerTool("figma_create_polygon", {
    description: "Create a polygon in Figma.",
    parameters: Type.Object({
      sides: Type.Number({ description: "Number of sides" }),
      width: Type.Number(),
      height: Type.Number(),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
      hex: HexParam,
      parentId: ParentIdParam,
    }),
  }, async (p) => json(await exec("create_polygon", p)));

  api.registerTool("figma_create_star", {
    description: "Create a star shape in Figma.",
    parameters: Type.Object({
      points: Type.Number({ description: "Number of star points" }),
      width: Type.Number(),
      height: Type.Number(),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
      hex: HexParam,
      parentId: ParentIdParam,
    }),
  }, async (p) => json(await exec("create_star", p)));

  api.registerTool("figma_add_text", {
    description: "Add a text node in Figma.",
    parameters: Type.Object({
      text: Type.String({ description: "Text content" }),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
      fontFamily: Type.Optional(Type.String({ description: "Font family (default: 'Inter')" })),
      fontStyle: Type.Optional(Type.String({ description: "Font style (default: 'Regular')" })),
      fontSize: Type.Optional(Type.Number({ description: "Font size (default: 32)" })),
      hex: HexParam,
      parentId: ParentIdParam,
    }),
  }, async (p) => json(await exec("add_text", p)));

  api.registerTool("figma_place_image", {
    description: "Place an image in Figma from base64-encoded data.",
    parameters: Type.Object({
      base64: Type.String({ description: "Base64-encoded image data" }),
      width: Type.Number(),
      height: Type.Number(),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
      parentId: ParentIdParam,
    }),
  }, async (p) => json(await exec("place_image_base64", p)));

  // ── Find / Select ──

  api.registerTool("figma_find_nodes", {
    description: "Find nodes in the current Figma page by type or name.",
    parameters: Type.Object({
      type: Type.Optional(Type.String({ description: "Node type filter (FRAME, RECTANGLE, TEXT, etc.)" })),
      nameContains: Type.Optional(Type.String({ description: "Case-insensitive name substring" })),
      within: Type.Optional(Type.String({ description: "Search within this node ID" })),
    }),
  }, async (p) => json(await exec("find_nodes", p)));

  api.registerTool("figma_select_nodes", {
    description: "Select specific nodes in Figma.",
    parameters: Type.Object({
      nodeIds: Type.Array(Type.String(), { description: "Node IDs to select" }),
    }),
  }, async (p) => json(await exec("select_nodes", p)));

  api.registerTool("figma_get_selection", {
    description: "Get currently selected nodes in Figma.",
    parameters: Type.Object({}),
  }, async () => json(await exec("get_selection")));

  // ── Page management ──

  api.registerTool("figma_create_page", {
    description: "Create a new page in the Figma file.",
    parameters: Type.Object({
      name: Type.Optional(Type.String({ description: "Page name" })),
      makeCurrent: Type.Optional(Type.Boolean({ description: "Switch to this page (default: true)" })),
    }),
  }, async (p) => json(await exec("create_page", p)));

  api.registerTool("figma_set_current_page", {
    description: "Switch to a different page in Figma.",
    parameters: Type.Object({
      pageId: Type.String({ description: "Page node ID" }),
    }),
  }, async (p) => json(await exec("set_current_page", p)));

  // ── Node management ──

  api.registerTool("figma_rename_node", {
    description: "Rename a node in Figma.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      name: Type.String({ description: "New name" }),
    }),
  }, async (p) => json(await exec("rename_node", p)));

  api.registerTool("figma_delete_node", {
    description: "Delete a node from Figma.",
    parameters: Type.Object({ nodeId: NodeIdParam }),
  }, async (p) => json(await exec("delete_node", p)));

  api.registerTool("figma_duplicate_node", {
    description: "Duplicate a node in Figma.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      x: Type.Optional(Type.Number({ description: "X position of the copy" })),
      y: Type.Optional(Type.Number({ description: "Y position of the copy" })),
    }),
  }, async (p) => json(await exec("duplicate_node", p)));

  api.registerTool("figma_resize_node", {
    description: "Resize a node in Figma.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      width: Type.Number(),
      height: Type.Number(),
    }),
  }, async (p) => json(await exec("resize_node", p)));

  api.registerTool("figma_rotate_node", {
    description: "Rotate a node in Figma.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      rotation: Type.Number({ description: "Rotation in degrees" }),
    }),
  }, async (p) => json(await exec("rotate_node", p)));

  api.registerTool("figma_set_position", {
    description: "Set the absolute position of a node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      x: Type.Number(),
      y: Type.Number(),
    }),
  }, async (p) => json(await exec("set_position", p)));

  api.registerTool("figma_group_nodes", {
    description: "Group multiple nodes together.",
    parameters: Type.Object({
      nodeIds: Type.Array(Type.String(), { description: "Node IDs to group (need 2+)" }),
      name: Type.Optional(Type.String({ description: "Group name" })),
    }),
  }, async (p) => json(await exec("group_nodes", p)));

  api.registerTool("figma_ungroup", {
    description: "Ungroup a group node, releasing its children.",
    parameters: Type.Object({
      groupId: Type.String({ description: "Group node ID" }),
    }),
  }, async (p) => json(await exec("ungroup", p)));

  // ── Styling ──

  api.registerTool("figma_set_fill", {
    description: "Set the fill color of a node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      hex: Type.String({ description: "Fill color hex" }),
      opacity: Type.Optional(Type.Number({ description: "Opacity 0-1" })),
    }),
  }, async (p) => json(await exec("set_fill", p)));

  api.registerTool("figma_set_stroke", {
    description: "Set the stroke of a node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      hex: Type.String({ description: "Stroke color hex" }),
      opacity: Type.Optional(Type.Number()),
      strokeWeight: Type.Optional(Type.Number()),
      strokeAlign: Type.Optional(Type.String({ description: "INSIDE | OUTSIDE | CENTER" })),
      dashPattern: Type.Optional(Type.Array(Type.Number())),
      cap: Type.Optional(Type.String()),
      join: Type.Optional(Type.String()),
    }),
  }, async (p) => json(await exec("set_stroke", p)));

  api.registerTool("figma_set_corner_radius", {
    description: "Set corner radius of a node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      radius: Type.Optional(Type.Number({ description: "Uniform corner radius" })),
      topLeft: Type.Optional(Type.Number()),
      topRight: Type.Optional(Type.Number()),
      bottomRight: Type.Optional(Type.Number()),
      bottomLeft: Type.Optional(Type.Number()),
    }),
  }, async (p) => json(await exec("set_corner_radius", p)));

  api.registerTool("figma_set_opacity", {
    description: "Set the opacity of a node (0-1).",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      opacity: Type.Number({ description: "Opacity 0-1" }),
    }),
  }, async (p) => json(await exec("set_opacity", p)));

  api.registerTool("figma_set_blend_mode", {
    description: "Set the blend mode of a node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      mode: Type.String({ description: "Blend mode (NORMAL, MULTIPLY, SCREEN, etc.)" }),
    }),
  }, async (p) => json(await exec("set_blend_mode", p)));

  api.registerTool("figma_add_effect", {
    description: "Add a visual effect (shadow, blur) to a node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      type: Type.String({ description: "DROP_SHADOW | INNER_SHADOW | LAYER_BLUR | BACKGROUND_BLUR" }),
      radius: Type.Optional(Type.Number({ description: "Blur radius (default: 8)" })),
      spread: Type.Optional(Type.Number()),
      hex: Type.Optional(Type.String({ description: "Shadow color hex" })),
      opacity: Type.Optional(Type.Number()),
      offsetX: Type.Optional(Type.Number()),
      offsetY: Type.Optional(Type.Number()),
    }),
  }, async (p) => json(await exec("add_effect", p)));

  api.registerTool("figma_clear_effects", {
    description: "Remove all effects from a node.",
    parameters: Type.Object({ nodeId: NodeIdParam }),
  }, async (p) => json(await exec("clear_effects", p)));

  // ── Auto Layout ──

  api.registerTool("figma_set_auto_layout", {
    description: "Configure Auto Layout on a frame. Enables responsive layout behavior.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      layoutMode: Type.Optional(Type.String({ description: "HORIZONTAL | VERTICAL | NONE" })),
      primaryAxisSizingMode: Type.Optional(Type.String({ description: "FIXED | AUTO" })),
      counterAxisSizingMode: Type.Optional(Type.String({ description: "FIXED | AUTO" })),
      itemSpacing: Type.Optional(Type.Number()),
      paddingTop: Type.Optional(Type.Number()),
      paddingRight: Type.Optional(Type.Number()),
      paddingBottom: Type.Optional(Type.Number()),
      paddingLeft: Type.Optional(Type.Number()),
      primaryAxisAlignItems: Type.Optional(Type.String({ description: "MIN | CENTER | MAX | SPACE_BETWEEN" })),
      counterAxisAlignItems: Type.Optional(Type.String({ description: "MIN | CENTER | MAX" })),
      layoutWrap: Type.Optional(Type.String({ description: "NO_WRAP | WRAP" })),
      counterAxisSpacing: Type.Optional(Type.Number()),
    }),
  }, async (p) => json(await exec("set_auto_layout", p)));

  api.registerTool("figma_set_constraints", {
    description: "Set layout constraints on a node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      horizontal: Type.Optional(Type.String({ description: "MIN | CENTER | MAX | STRETCH | SCALE" })),
      vertical: Type.Optional(Type.String({ description: "MIN | CENTER | MAX | STRETCH | SCALE" })),
    }),
  }, async (p) => json(await exec("set_constraints", p)));

  // ── Text editing ──

  api.registerTool("figma_set_text_content", {
    description: "Change the text content of an existing text node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      text: Type.String({ description: "New text content" }),
    }),
  }, async (p) => json(await exec("set_text_content", p)));

  api.registerTool("figma_set_text_style", {
    description: "Apply text styling (font, size, spacing) to a text node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      fontFamily: Type.Optional(Type.String()),
      fontStyle: Type.Optional(Type.String()),
      fontSize: Type.Optional(Type.Number()),
      lineHeight: Type.Optional(Type.Number()),
      letterSpacing: Type.Optional(Type.Number()),
      textAlignHorizontal: Type.Optional(Type.String({ description: "LEFT | CENTER | RIGHT | JUSTIFIED" })),
      textAutoResize: Type.Optional(Type.String({ description: "NONE | WIDTH_AND_HEIGHT | HEIGHT" })),
    }),
  }, async (p) => json(await exec("set_text_style", p)));

  api.registerTool("figma_set_text_color", {
    description: "Set the color of a text node.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      hex: Type.String({ description: "Text color hex" }),
      opacity: Type.Optional(Type.Number()),
    }),
  }, async (p) => json(await exec("set_text_color", p)));

  // ── Components & Boolean ──

  api.registerTool("figma_create_component", {
    description: "Create a reusable component in Figma.",
    parameters: Type.Object({
      name: Type.Optional(Type.String({ description: "Component name" })),
      fromNodeIds: Type.Optional(Type.Array(Type.String(), { description: "Existing node IDs to move into the component" })),
    }),
  }, async (p) => json(await exec("create_component", p)));

  api.registerTool("figma_create_instance", {
    description: "Create an instance of an existing component.",
    parameters: Type.Object({
      componentId: Type.String({ description: "Component node ID" }),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
    }),
  }, async (p) => json(await exec("create_instance", p)));

  api.registerTool("figma_detach_instance", {
    description: "Detach a component instance, converting it to a regular frame.",
    parameters: Type.Object({ nodeId: NodeIdParam }),
  }, async (p) => json(await exec("detach_instance", p)));

  api.registerTool("figma_boolean_op", {
    description: "Perform a boolean operation on vector nodes.",
    parameters: Type.Object({
      op: Type.String({ description: "UNION | SUBTRACT | INTERSECT | EXCLUDE" }),
      nodeIds: Type.Array(Type.String(), { description: "Node IDs to combine (2+)" }),
      name: Type.Optional(Type.String()),
    }),
  }, async (p) => json(await exec("boolean_op", p)));

  // ── Layout Grid ──

  api.registerTool("figma_layout_grid_add", {
    description: "Add a layout grid to a frame.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      pattern: Type.Optional(Type.String({ description: "COLUMNS | ROWS | GRID (default: COLUMNS)" })),
      count: Type.Optional(Type.Number({ description: "Number of columns/rows (default: 12)" })),
      gutterSize: Type.Optional(Type.Number()),
      sectionSize: Type.Optional(Type.Number()),
      hex: HexParam,
      opacity: Type.Optional(Type.Number()),
    }),
  }, async (p) => json(await exec("layout_grid_add", p)));

  api.registerTool("figma_layout_grid_clear", {
    description: "Remove all layout grids from a frame.",
    parameters: Type.Object({ nodeId: NodeIdParam }),
  }, async (p) => json(await exec("layout_grid_clear", p)));

  // ── Export / Data / Batch ──

  api.registerTool("figma_export_node", {
    description: "Export a node as PNG, JPG, or SVG (via the Figma plugin, not REST API).",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      format: Type.Optional(Type.String({ description: "PNG | JPG | SVG (default: PNG)" })),
      scale: Type.Optional(Type.Number({ description: "Export scale (default: 1)" })),
    }),
  }, async (p) => json(await exec("export_node", p)));

  api.registerTool("figma_set_properties", {
    description: "Batch-set multiple properties on a node at once.",
    parameters: Type.Object({
      nodeId: NodeIdParam,
      props: Type.Record(Type.String(), Type.Unknown(), {
        description: "Key-value pairs of properties to set (x, y, opacity, visible, fills, strokes, etc.)",
      }),
    }),
  }, async (p) => json(await exec("set_properties", p)));

  // ── Bridge status ──

  api.registerTool("figma_bridge_status", {
    description: "Check if the Figma plugin is connected to the bridge.",
    parameters: Type.Object({}),
  }, async () => json({ connected: bridge.isConnected }));
}
