# figma-designer-mcp

[![npm](https://img.shields.io/npm/v/figma-designer-mcp)](https://www.npmjs.com/package/figma-designer-mcp)
[![license](https://img.shields.io/npm/l/figma-designer-mcp)](./LICENSE)

MCP server that gives AI agents full read **and write** access to Figma — 50+ tools for creating frames, placing components, styling, auto layout, and more.

Works with any MCP-compatible client (Claude Desktop, Cursor, Continue, etc.) and also as an [OpenClaw](#openclaw-mode) extension.

English | [中文](./README.zh-CN.md)

![figma-designer-mcp demo](https://github.com/a1245582339/picx-images-hosting/raw/master/ScreenShot_2026-03-06_092528_621.4ubhacbd2e.png)

- **Read** — powered by the Figma REST API (no plugin required).
- **Write** — powered by a lightweight Figma plugin that connects via WebSocket and executes Plugin API operations in real time.

## vs. Figma Official MCP

[Figma's official MCP server](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) is designed for the **Design → Code** direction: it helps developers read existing designs and generate code. `figma-designer-mcp` is built for the **opposite direction — Code/AI → Design**: it lets AI agents **create and modify** designs directly on the Figma canvas.

| | **figma-designer-mcp** | **Figma Official MCP** |
|---|---|---|
| **Direction** | AI → Design (create & edit designs) | Design → Code (read designs, generate code) |
| **Write tools** | 44+ write tools — create frames, shapes, text, place components, set styles, auto layout, etc. | Virtually none — `generate_figma_design` captures live UI but cannot create or edit design elements |
| **Read tools** | 6 REST API tools — read nodes, screenshot, list components/styles, comments | ~13 tools — design context, variables, metadata, screenshots, Code Connect |
| **Component manipulation** | Search, instantiate, configure variant properties, duplicate, reparent | Read-only — extract component info for code generation |
| **Page & node management** | Create/switch pages, rename/delete/duplicate/group/resize/rotate nodes | No page or node manipulation |
| **Styling control** | Fill, stroke, corner radius, opacity, blend mode, effects (shadow/blur) | No direct styling — returns style data for code output |
| **Auto layout** | Full auto layout configuration (direction, spacing, padding, alignment, wrap) | No layout editing |
| **Client support** | All MCP clients equally — no feature restrictions | Some features limited to specific clients (e.g. `generate_figma_design` requires Claude Code or Codex) |
| **Hosting** | Self-hosted, open source (MIT) | Remote (Figma-hosted) or desktop app |
| **Pricing** | Free | Requires paid Figma plan for desktop server |

**In short:** Figma's official MCP helps you turn designs into code. `figma-designer-mcp` helps AI turn ideas into designs. They are complementary — you can use both together in the same project.

## Best Practices

Check out the **[Best Practices Guide](./docs/best-practices.md)** for proven strategies to get the most out of this tool:

- **Use a component library file** (e.g. Ant Design) as your workspace — search & reuse 3–5x faster than drawing from scratch
- **Create a template frame** for consistent page layout across multi-page designs
- **Duplicate instead of redraw** — for tables, lists, and grids, create one item then copy it
- **Configure variant properties** instead of manually editing component internals
- **Use the icon library** — search and instantiate, don't draw icons by hand

These techniques compound to reduce tool calls by **60–80%**, saving both time and tokens.

## Quick Start

```bash
FIGMA_TOKEN=figd_xxxxxxxxxxxx npx figma-designer-mcp
```

Or install globally:

```bash
npm install -g figma-designer-mcp
FIGMA_TOKEN=figd_xxxxxxxxxxxx figma-designer-mcp
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FIGMA_TOKEN` | Yes | Figma Personal Access Token ([generate here](https://www.figma.com/developers/api#access-tokens)) |
| `FIGMA_BRIDGE_PORT` | No | WebSocket bridge port (default: `3055`) |

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["figma-designer-mcp"],
      "env": {
        "FIGMA_TOKEN": "figd_xxxxxxxxxxxx"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["figma-designer-mcp"],
      "env": {
        "FIGMA_TOKEN": "figd_xxxxxxxxxxxx"
      }
    }
  }
}
```

### Other MCP Clients

Any client that supports the MCP stdio transport:

```json
{
  "command": "npx",
  "args": ["figma-designer-mcp"],
  "env": { "FIGMA_TOKEN": "figd_xxxxxxxxxxxx" }
}
```

## Figma Plugin Setup (for Write Tools)

Read tools work out of the box. Write tools (creating nodes, styling, auto layout, etc.) require a companion Figma plugin that acts as the execution bridge.

### 1. Build the plugin

```bash
cd /path/to/figma-designer-mcp   # or: npx figma-designer-mcp --help to find install location
npm run build:plugin
```

This compiles `figma-plugin/src/plugin.ts` → `figma-plugin/plugin.js` using esbuild.

### 2. Import into Figma

1. Open **Figma** (desktop app or browser).
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Select `figma-plugin/manifest.json` from the package directory.
4. Open the Figma file you want to design in.
5. Run the plugin: **Plugins → Development → AI Figma Designer**.

The plugin opens a UI where you enter the MCP server address and port, then click **Connect**. Configuration is persisted via Figma's `clientStorage`. The plugin auto-reconnects on disconnection.

> **Tip:** Duplicate a design system community file (e.g. [Ant Design Open Source](https://www.figma.com/community/file/831698976089873405)), open the duplicate, and run the plugin. The agent can then use `figma_search_components` to find components and `figma_create_instance` to place them.

## Architecture

```
AI Client (Claude, Cursor, etc.)
  │  MCP stdio transport
  ▼
figma-designer-mcp
  ├── REST API client  →  Figma API (read, screenshot, components, styles, comments)
  └── WebSocket server (FigmaBridge, default port 3055)
                              ▼
               Figma Client (Desktop or Browser)
                 └── "AI Figma Designer" plugin
                     └── Executes Plugin API calls (create nodes, set styles, auto layout …)
```

### Read path

Agent calls `figma_read` / `figma_screenshot` / etc. → MCP server makes an HTTP request to `https://api.figma.com/v1/...` using `FIGMA_TOKEN` → returns structured data.

### Write path

1. MCP server starts a WebSocket server on port `FIGMA_BRIDGE_PORT` (default `3055`).
2. The Figma plugin connects to this WebSocket server.
3. When an agent calls a write tool (e.g. `figma_create_frame`), the server sends a JSON message:
   ```json
   { "id": "req_1", "action": "create_frame", "args": { "name": "Login Page", "width": 1440, "height": 900 } }
   ```
4. The plugin executes `figma.createFrame()` via the Plugin API and replies:
   ```json
   { "replyTo": "req_1", "result": { "ok": true, "nodeId": "123:456", "type": "FRAME", "name": "Login Page" } }
   ```
5. The server resolves the promise and returns the result to the agent.

Each request has a 30-second timeout. If the plugin disconnects mid-operation, pending requests are rejected immediately.

### Auto-positioning

All creation tools automatically place new top-level elements to the right of existing content when:
1. No `parentId` is specified (placed at page root level)
2. No explicit `x` or `y` is provided

This prevents overlapping. Elements placed inside a Frame (with `parentId`) are not affected.

## Available Tools

### Read Tools (REST API — no plugin needed)

| Tool | Description |
|---|---|
| `figma_read` | Read a Figma file or specific nodes. Returns node tree with layout, style, and text info. |
| `figma_screenshot` | Export nodes as images (PNG, JPG, SVG, PDF). Returns download URLs. |
| `figma_components` | List all components in a file (name, description, key, node ID). |
| `figma_styles` | List all styles in a file (colors, text styles, effects, grids). |
| `figma_comment` | Post a comment on a file, optionally attached to a specific node. |
| `figma_get_comments` | Read all comments on a file. Returns text, author, timestamp. |

### Write Tools (WebSocket bridge — plugin required)

#### Creation

| Tool | Description |
|---|---|
| `figma_create_frame` | Create a frame (artboard). Params: `name`, `width`, `height`, `x`, `y`, `parentId`. |
| `figma_create_rectangle` | Create a rectangle. Params: `width`, `height`, `x`, `y`, `cornerRadius`, `hex`, `parentId`. |
| `figma_create_ellipse` | Create an ellipse / circle. Params: `width`, `height`, `x`, `y`, `hex`, `parentId`. |
| `figma_create_line` | Create a line. Params: `length`, `x`, `y`, `rotation`, `strokeHex`, `strokeWeight`, `parentId`. |
| `figma_create_polygon` | Create a polygon. Params: `sides`, `width`, `height`, `x`, `y`, `hex`, `parentId`. |
| `figma_create_star` | Create a star shape. Params: `points`, `width`, `height`, `x`, `y`, `hex`, `parentId`. |
| `figma_add_text` | Add a text node. Params: `text`, `x`, `y`, `fontFamily`, `fontStyle`, `fontSize`, `hex`, `parentId`. |
| `figma_place_image` | Place an image from base64 data. Params: `base64`, `width`, `height`, `x`, `y`, `parentId`. |

#### Find & Select

| Tool | Description |
|---|---|
| `figma_find_nodes` | Find nodes in the current page by type or name substring. Params: `type`, `nameContains`, `within`. |
| `figma_find_nodes_all_pages` | Search nodes across **all pages** by type and/or name. Returns node ID, type, name, and page. Params: `type`, `nameContains`, `nameEquals`, `limit`. |
| `figma_select_nodes` | Select nodes by ID. Params: `nodeIds`. |
| `figma_get_selection` | Get the current selection. |

#### Page Management

| Tool | Description |
|---|---|
| `figma_list_pages` | List all pages in the file with IDs and names, and show the current active page. |
| `figma_create_page` | Create a new page. Params: `name`, `makeCurrent`. |
| `figma_set_current_page` | Switch to a page. Params: `pageId`. |
| `figma_get_page_bounds` | Get the bounding box of all content on the current page, plus a suggested position for placing new elements without overlap. |

#### Node Management

| Tool | Description |
|---|---|
| `figma_rename_node` | Rename a node. Params: `nodeId`, `name`. |
| `figma_delete_node` | Delete a node. Params: `nodeId`. |
| `figma_duplicate_node` | Duplicate a node. Params: `nodeId`, `x`, `y`. |
| `figma_resize_node` | Resize a node. Params: `nodeId`, `width`, `height`. |
| `figma_rotate_node` | Rotate a node. Params: `nodeId`, `rotation`. |
| `figma_set_position` | Set absolute position. Params: `nodeId`, `x`, `y`. |
| `figma_group_nodes` | Group nodes. Params: `nodeIds`, `name`. |
| `figma_ungroup` | Ungroup. Params: `groupId`. |
| `figma_reparent_node` | Move a node into a different container (frame, group, page). Params: `nodeId`, `newParentId`, `index`. |

#### Styling

| Tool | Description |
|---|---|
| `figma_set_fill` | Set fill color. Params: `nodeId`, `hex`, `opacity`. |
| `figma_set_stroke` | Set stroke. Params: `nodeId`, `hex`, `opacity`, `strokeWeight`, `strokeAlign`, `dashPattern`, `cap`, `join`. |
| `figma_set_corner_radius` | Set corner radius (uniform or per-corner). Params: `nodeId`, `radius`, `topLeft`, `topRight`, `bottomRight`, `bottomLeft`. |
| `figma_set_opacity` | Set opacity (0–1). Params: `nodeId`, `opacity`. |
| `figma_set_blend_mode` | Set blend mode. Params: `nodeId`, `mode`. |
| `figma_add_effect` | Add shadow or blur. Params: `nodeId`, `type`, `radius`, `spread`, `hex`, `opacity`, `offsetX`, `offsetY`. |
| `figma_clear_effects` | Remove all effects. Params: `nodeId`. |

#### Layout

| Tool | Description |
|---|---|
| `figma_set_auto_layout` | Configure Auto Layout on a frame. Params: `nodeId`, `layoutMode`, `itemSpacing`, `padding*`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `layoutWrap`, etc. |
| `figma_set_constraints` | Set constraints. Params: `nodeId`, `horizontal`, `vertical`. |
| `figma_layout_grid_add` | Add a layout grid. Params: `nodeId`, `pattern`, `count`, `gutterSize`, `sectionSize`, `hex`, `opacity`. |
| `figma_layout_grid_clear` | Remove all layout grids. Params: `nodeId`. |

#### Text Editing

| Tool | Description |
|---|---|
| `figma_set_text_content` | Change text content. Params: `nodeId`, `text`. |
| `figma_set_text_style` | Apply text styling. Params: `nodeId`, `fontFamily`, `fontStyle`, `fontSize`, `lineHeight`, `letterSpacing`, `textAlignHorizontal`, `textAutoResize`. |
| `figma_set_text_color` | Set text color. Params: `nodeId`, `hex`, `opacity`. |

#### Components & Boolean

| Tool | Description |
|---|---|
| `figma_create_component` | Create a reusable component. Params: `name`, `fromNodeIds`. |
| `figma_create_instance` | Instantiate a component. Params: `componentId`, `x`, `y`, `parentId`. |
| `figma_detach_instance` | Detach an instance to a regular frame. Params: `nodeId`. |
| `figma_boolean_op` | Boolean operation (UNION, SUBTRACT, INTERSECT, EXCLUDE). Params: `op`, `nodeIds`, `name`. |

#### Component Library

| Tool | Description |
|---|---|
| `figma_list_local_components` | List all components in the file. Params: `pageFilter` (optional, filter by page name), `limit` (default 200). Returns component name, ID, variant properties, and page location. |
| `figma_search_components` | Search components by name, component set name, or description. Params: `query`, `limit` (default 50). |
| `figma_get_component_properties` | Read all configurable properties (variants, booleans, text overrides) of a component instance. Returns property names, types, current values, and available options. Params: `nodeId`. |
| `figma_set_component_properties` | Set variant properties on a component instance (e.g. Table rows/columns, Button type/size). Supports fuzzy matching on property names. Params: `nodeId`, `properties`. |

#### Export & Utilities

| Tool | Description |
|---|---|
| `figma_export_node` | Export a node as PNG/JPG/SVG via the plugin. Params: `nodeId`, `format`, `scale`. |
| `figma_set_properties` | Batch-set multiple properties. Params: `nodeId`, `props`. |
| `figma_bridge_status` | Check if the Figma plugin is connected. |

## Dynamic Tool Loading

Instead of exposing all 50+ tools at once (~4000 tokens in tool definitions), the server uses **dynamic tool loading** by default. Only a small set of core tools (~9) plus meta-tools are loaded initially. The LLM loads additional tool groups on demand as needed.

### How It Works

Tools are organized into 8 categories:

| Category | Tools | Description |
|---|---|---|
| `core` | 7 | Read files, screenshot, find/select nodes, list pages, bridge status (**always loaded**) |
| `create` | 9 | Create frames, rectangles, ellipses, lines, polygons, stars, text, images, pages |
| `modify` | 10 | Rename, delete, duplicate, resize, rotate, reposition, group/ungroup, reparent nodes |
| `style` | 7 | Fill, stroke, corner radius, opacity, blend mode, effects |
| `layout` | 5 | Auto layout, constraints, layout grids, page bounds |
| `text` | 3 | Text content, style, color |
| `component` | 9 | Components, instances, boolean ops, properties, library search |
| `export` | 6 | Export, batch properties, REST components/styles, comments |

Two meta-tools manage loading:

- **`figma_load_toolset`** — Load one or more tool categories (e.g. `"create,style"` or `"all"`).
- **`figma_unload_toolset`** (MCP) / **`figma_list_toolsets`** (OpenClaw) — Unload categories or list their status.

The LLM sees the category descriptions in `figma_load_toolset` and loads what it needs. For example, when asked to "create a login page", it calls `figma_load_toolset("create,style,text,layout")` to load 24 relevant tools.

### Token Savings

| Mode | Tool tokens (approx.) |
|---|---|
| All tools (default) | ~4000 tokens |
| Dynamic — initial load | ~500 tokens (core + meta-tools) |
| Dynamic — typical task | ~1500–2500 tokens (core + 2–3 categories) |

Typical savings: **60–80%** of tool definition tokens.

## Development

### Building

```bash
npm run build           # Build everything (plugin + MCP server)
npm run build:plugin    # Build Figma plugin only
npm run build:mcp       # Build MCP server only
```

- `build:plugin` compiles `figma-plugin/src/plugin.ts` → `figma-plugin/plugin.js` (IIFE, ES2015, browser)
- `build:mcp` compiles `mcp-server.ts` → `dist/mcp-server.js` (ESM, Node 18+)

After modifying `plugin.ts`, rebuild and restart the Figma plugin to pick up changes.

### Adding new tools

1. Add the tool definition in `src/tool-defs.ts` (single source of truth for both OpenClaw and MCP modes).
2. **Bridge-based tools (write):** Add a new action handler in `figma-plugin/src/plugin.ts`. Use the `bt()` helper in `tool-defs.ts` for the tool definition.
3. **REST API tools (read):** Add a client method in `src/client.ts`. Write a custom execute function in `tool-defs.ts`.

### File Structure

```
figma-designer-mcp/
├── mcp-server.ts             # MCP server entry point
├── index.ts                  # OpenClaw plugin entry (alternative mode)
├── openclaw.plugin.json      # OpenClaw plugin manifest
├── package.json
├── LICENSE
├── src/
│   ├── tool-defs.ts          # Shared tool definitions (single source of truth)
│   ├── tool-registry.ts      # Tool categories & dynamic loading registry
│   ├── client.ts             # Figma REST API client (read operations)
│   ├── tools.ts              # OpenClaw adapter — read tools
│   ├── write-tools.ts        # OpenClaw adapter — write tools
│   └── bridge.ts             # WebSocket server — accepts Figma plugin connections
├── dist/                     # Build output
│   └── mcp-server.js         # Compiled MCP server (generated by npm run build:mcp)
├── figma-plugin/             # Figma plugin (import into Figma for write operations)
│   ├── manifest.json
│   ├── ui.html               # Plugin UI — server config & WebSocket client
│   ├── src/
│   │   └── plugin.ts         # TypeScript source (action dispatcher)
│   ├── plugin.js             # Compiled output (generated by npm run build:plugin)
│   ├── tsconfig.json
│   └── assets/
│       └── logo.jpeg
└── .gitignore
```

## Troubleshooting

### "Figma plugin not connected"

- Make sure the Figma plugin is running (Plugins → Development → AI Figma Designer).
- Check that the WebSocket address in the plugin UI matches the server IP and port.
- Verify no firewall is blocking the bridge port.

### Plugin connects but operations fail

- Open the Figma plugin console (Plugins → Development → Open Console) to see error messages.
- Ensure you have a file open in Figma — the plugin operates on the current page.

### Read tools work but write tools don't

- Read tools use the REST API and don't need the plugin. Write tools require the plugin to be running and connected. Check `figma_bridge_status` to verify connectivity.

### Font errors on `figma_add_text`

- The font must be available in Figma. Default is `Inter` which is always available.
- For custom fonts, ensure they are installed or available in your Figma account.

## OpenClaw Mode

This package also works as an OpenClaw extension. To use it in OpenClaw instead of as a standalone MCP server:

### Prerequisites

| Requirement | Details |
|---|---|
| **OpenClaw** | Gateway running with the `figma-designer` plugin enabled |
| **Figma Personal Access Token** | Generate at https://www.figma.com/developers/api#access-tokens |
| **Figma Desktop or Browser** | Required for write operations |

### Configuration

Add to `openclaw.json`:

```jsonc
{
  "plugins": {
    "entries": {
      "figma-designer": {
        "enabled": true,
        "config": {
          "personalAccessToken": "figd_xxxxxxxxxxxx",
          "bridgePort": 3055          // optional, default 3055
        }
      }
    }
  }
}
```

Restart the OpenClaw gateway after updating configuration.

## License

MIT — see [LICENSE](./LICENSE).
