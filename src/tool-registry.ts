import { Type } from "@sinclair/typebox";
import { type ToolDef, allToolDefs } from "./tool-defs.js";

// ── Tool categories ──

export const toolCategories = {
  core: [
    "figma_read",
    "figma_screenshot",
    "figma_find_nodes",
    "figma_get_selection",
    "figma_bridge_status",
    "figma_list_pages",
    "figma_select_nodes",
  ],
  create: [
    "figma_create_frame",
    "figma_create_rectangle",
    "figma_create_ellipse",
    "figma_create_line",
    "figma_create_polygon",
    "figma_create_star",
    "figma_add_text",
    "figma_place_image",
    "figma_create_page",
  ],
  modify: [
    "figma_rename_node",
    "figma_delete_node",
    "figma_duplicate_node",
    "figma_resize_node",
    "figma_rotate_node",
    "figma_set_position",
    "figma_group_nodes",
    "figma_ungroup",
    "figma_reparent_node",
    "figma_set_current_page",
  ],
  style: [
    "figma_set_fill",
    "figma_set_stroke",
    "figma_set_corner_radius",
    "figma_set_opacity",
    "figma_set_blend_mode",
    "figma_add_effect",
    "figma_clear_effects",
  ],
  layout: [
    "figma_set_auto_layout",
    "figma_set_constraints",
    "figma_layout_grid_add",
    "figma_layout_grid_clear",
    "figma_get_page_bounds",
  ],
  text: [
    "figma_set_text_content",
    "figma_set_text_style",
    "figma_set_text_color",
  ],
  component: [
    "figma_create_component",
    "figma_create_instance",
    "figma_detach_instance",
    "figma_boolean_op",
    "figma_get_component_properties",
    "figma_set_component_properties",
    "figma_list_local_components",
    "figma_search_components",
    "figma_find_nodes_all_pages",
  ],
  export: [
    "figma_export_node",
    "figma_set_properties",
    "figma_components",
    "figma_styles",
  ],
  comment: [
    "figma_comment",
    "figma_get_comments",
  ],
} as const;

export type ToolCategory = keyof typeof toolCategories;

const categoryDescriptions: Record<ToolCategory, string> = {
  core: "Read files, screenshot, find/select nodes, list pages, bridge status (always loaded)",
  create: "Create frames, rectangles, ellipses, lines, polygons, stars, text, images, pages",
  modify: "Rename, delete, duplicate, resize, rotate, reposition, group/ungroup, reparent nodes, switch pages",
  style: "Set fill, stroke, corner radius, opacity, blend mode, add/clear effects",
  layout: "Auto layout, constraints, layout grids, page bounds",
  text: "Set text content, text style, text color",
  component: "Create components/instances, detach, boolean ops, get/set component properties, search components",
  export: "Export nodes as images, batch set properties, list components/styles via REST",
  comment: "Post and read comments on the Figma file",
};

// ── Meta-tool definitions ──

function makeLoadToolsetDef(registry: ToolRegistry): ToolDef {
  return {
    name: "figma_load_toolset",
    description:
      "Load Figma tools by category. ONLY load what you need for the current task — " +
      "loading unnecessary tools wastes context tokens.\n\n" +
      "Available categories:\n" +
      Object.entries(categoryDescriptions)
        .map(([k, v]) => `• ${k}: ${v}`)
        .join("\n") +
      "\n\nTask-based recommendations:\n" +
      "• Drawing/creating UI: create,style,layout,text\n" +
      "• Editing existing designs: modify,style,text\n" +
      "• Working with components: component\n" +
      "• Exporting assets: export\n" +
      "• Reviewing/commenting: comment\n" +
      '\nAvoid loading "all" unless truly needed.',
    parameters: Type.Object({
      categories: Type.String({
        description:
          'Comma-separated category names to load (e.g. "create,style,layout,text"). Only load what the task requires.',
      }),
    }),
    async execute(params: { categories: string }) {
      const raw = params.categories.trim();
      if (raw === "all") {
        const loaded: string[] = [];
        for (const cat of Object.keys(toolCategories) as ToolCategory[]) {
          if (cat === "core") continue;
          loaded.push(...registry.loadCategory(cat));
        }
        return {
          status: "ok",
          loaded_categories: Object.keys(toolCategories),
          loaded_tools: loaded,
        };
      }
      const requested = raw.split(",").map((s) => s.trim()) as ToolCategory[];
      const loaded: string[] = [];
      const invalid: string[] = [];
      for (const cat of requested) {
        if (cat in toolCategories) {
          loaded.push(...registry.loadCategory(cat));
        } else {
          invalid.push(cat);
        }
      }
      return {
        status: "ok",
        loaded_categories: requested.filter((c) => c in toolCategories),
        loaded_tools: loaded,
        ...(invalid.length ? { invalid_categories: invalid } : {}),
      };
    },
  };
}

function makeUnloadToolsetDef(registry: ToolRegistry): ToolDef {
  return {
    name: "figma_unload_toolset",
    description:
      "Unload a group of Figma tools to free context. Cannot unload 'core'. " +
      'Pass comma-separated category names (e.g. "create,style").',
    parameters: Type.Object({
      categories: Type.String({
        description: "Comma-separated category names to unload.",
      }),
    }),
    async execute(params: { categories: string }) {
      const requested = params.categories
        .split(",")
        .map((s) => s.trim()) as ToolCategory[];
      const unloaded: string[] = [];
      const skipped: string[] = [];
      for (const cat of requested) {
        if (cat === "core") {
          skipped.push(cat);
          continue;
        }
        if (registry.unloadCategory(cat)) {
          unloaded.push(cat);
        }
      }
      return {
        status: "ok",
        unloaded_categories: unloaded,
        ...(skipped.length ? { skipped: skipped, reason: "core cannot be unloaded" } : {}),
      };
    },
  };
}

// ── Registry ──

export class ToolRegistry {
  private toolMap: Map<string, ToolDef>;
  private activeCategories = new Set<ToolCategory>(["core"]);
  private metaTools: ToolDef[];
  private onChanged?: () => void;

  constructor(onChanged?: () => void) {
    this.toolMap = new Map(allToolDefs.map((t) => [t.name, t]));
    this.onChanged = onChanged;
    this.metaTools = [
      makeLoadToolsetDef(this),
      makeUnloadToolsetDef(this),
    ];
  }

  loadCategory(category: ToolCategory): string[] {
    if (this.activeCategories.has(category)) return toolCategories[category] as unknown as string[];
    this.activeCategories.add(category);
    this.onChanged?.();
    return toolCategories[category] as unknown as string[];
  }

  unloadCategory(category: ToolCategory): boolean {
    if (category === "core") return false;
    const removed = this.activeCategories.delete(category);
    if (removed) this.onChanged?.();
    return removed;
  }

  loadAll(): void {
    for (const cat of Object.keys(toolCategories) as ToolCategory[]) {
      this.activeCategories.add(cat);
    }
    this.onChanged?.();
  }

  /** Returns currently active tools + meta-tools. */
  getActiveTools(): ToolDef[] {
    const activeNames = new Set<string>();
    for (const cat of this.activeCategories) {
      for (const name of toolCategories[cat]) {
        activeNames.add(name);
      }
    }
    const tools = allToolDefs.filter((t) => activeNames.has(t.name));
    return [...tools, ...this.metaTools];
  }

  /** Find tool by name among active tools + meta-tools. */
  findTool(name: string): ToolDef | undefined {
    const meta = this.metaTools.find((t) => t.name === name);
    if (meta) return meta;

    const tool = this.toolMap.get(name);
    if (!tool) return undefined;

    const activeNames = new Set<string>();
    for (const cat of this.activeCategories) {
      for (const n of toolCategories[cat]) {
        activeNames.add(n);
      }
    }
    return activeNames.has(name) ? tool : undefined;
  }

  getActiveCategories(): ToolCategory[] {
    return [...this.activeCategories];
  }
}
