# @openclaw/figma-designer

An OpenClaw extension that gives AI agents full read **and write** access to Figma.

- **Read** — powered by the Figma REST API (no plugin required).
- **Write** — powered by a lightweight Figma plugin that connects to OpenClaw via WebSocket and executes Figma Plugin API operations in real time.

## Architecture

```
Agent (e.g. tanglang)
  │  calls figma_create_frame, figma_add_text, figma_set_fill …
  ▼
OpenClaw Gateway
  │  figma-designer extension
  │  ├── REST API client  →  Figma API (read, screenshot, components, styles, comments)
  │  └── WebSocket server (FigmaBridge, default port 3055)
  ▼
Figma Client (Desktop or Browser)
  └── "OpenClaw Figma Bridge" plugin
      └── Executes Figma Plugin API calls (create nodes, set styles, auto layout …)
```

## Prerequisites

| Requirement | Details |
|---|---|
| **OpenClaw** | Gateway running with the `figma-designer` plugin enabled |
| **Figma Personal Access Token** | Generate at https://www.figma.com/developers/api#access-tokens — needs `file_content:read` scope |
| **Figma Desktop or Browser** | Required for write operations (the plugin runs inside Figma) |
| **Network** | The machine running Figma must be able to reach the OpenClaw server on the bridge port (default `3055`) |

## Setup

### 1. Configure the extension in `openclaw.json`

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

### 2. Install the Figma plugin (for write operations)

The plugin source lives in `figma-plugin/` inside this extension directory.

1. Open **Figma** (desktop app or browser).
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Select `figma-plugin/manifest.json` from this directory.
4. Open the Figma file you want to design in.
5. Run the plugin: **Plugins → Development → OpenClaw Figma Bridge**.

The plugin runs with a hidden UI. It will automatically connect to `ws://127.0.0.1:3055` and keep reconnecting if the connection drops.

> **Remote server?** If OpenClaw runs on a different machine, edit the `SERVER` constant in `figma-plugin/ui.html`:
> ```js
> const SERVER = "ws://YOUR_SERVER_IP:3055";
> ```

### 3. Restart the OpenClaw gateway

After updating `openclaw.json`, restart the gateway so the extension loads and the WebSocket bridge starts listening.

## Available Tools

### Read Tools (REST API — no plugin needed)

| Tool | Description |
|---|---|
| `figma_read` | Read a Figma file or specific nodes. Returns node tree with layout, style, and text info. |
| `figma_screenshot` | Export nodes as images (PNG, JPG, SVG, PDF). Returns download URLs. |
| `figma_components` | List all components in a file (name, description, key, node ID). |
| `figma_styles` | List all styles in a file (colors, text styles, effects, grids). |
| `figma_comment` | Post a comment on a file, optionally attached to a specific node. |

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
| `figma_find_nodes` | Find nodes by type or name substring. Params: `type`, `nameContains`, `within`. |
| `figma_select_nodes` | Select nodes by ID. Params: `nodeIds`. |
| `figma_get_selection` | Get the current selection. |

#### Page Management

| Tool | Description |
|---|---|
| `figma_create_page` | Create a new page. Params: `name`, `makeCurrent`. |
| `figma_set_current_page` | Switch to a page. Params: `pageId`. |

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
| `figma_set_auto_layout` | Configure Auto Layout on a frame. Params: `nodeId`, `layoutMode`, `itemSpacing`, `padding*`, `primaryAxisAlignItems`, `counterAxisAlignItems`, etc. |
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
| `figma_create_instance` | Instantiate a component. Params: `componentId`, `x`, `y`. |
| `figma_detach_instance` | Detach an instance to a regular frame. Params: `nodeId`. |
| `figma_boolean_op` | Boolean operation (UNION, SUBTRACT, INTERSECT, EXCLUDE). Params: `op`, `nodeIds`, `name`. |

#### Export & Utilities

| Tool | Description |
|---|---|
| `figma_export_node` | Export a node as PNG/JPG/SVG via the plugin. Params: `nodeId`, `format`, `scale`. |
| `figma_set_properties` | Batch-set multiple properties. Params: `nodeId`, `props`. |
| `figma_bridge_status` | Check if the Figma plugin is connected. |

## File Structure

```
extensions/figma-designer/
├── index.ts                  # Plugin entry — registers read tools, starts bridge, registers write tools
├── openclaw.plugin.json      # Plugin manifest & config schema
├── package.json
├── src/
│   ├── client.ts             # Figma REST API client (read operations)
│   ├── tools.ts              # Read tool registrations (figma_read, figma_screenshot, etc.)
│   ├── bridge.ts             # WebSocket server — accepts Figma plugin connections
│   └── write-tools.ts        # Write tool registrations (35+ tools)
├── figma-plugin/             # Figma plugin (import into Figma for write operations)
│   ├── manifest.json
│   ├── plugin.js             # Action dispatcher — executes Figma Plugin API calls
│   └── ui.html               # Hidden UI — WebSocket client connecting to OpenClaw
└── .gitignore
```

## How It Works

### Read path

Agent calls `figma_read` / `figma_screenshot` / etc. → the extension makes an HTTP request to `https://api.figma.com/v1/...` using the configured Personal Access Token → returns structured data to the agent.

### Write path

1. The extension starts a WebSocket server on the configured `bridgePort` (default `3055`).
2. The Figma plugin (running inside Figma) connects to this WebSocket server.
3. When an agent calls a write tool (e.g. `figma_create_frame`), the extension sends a JSON message over WebSocket:
   ```json
   { "id": "req_1", "action": "create_frame", "args": { "name": "Login Page", "width": 1440, "height": 900 } }
   ```
4. The Figma plugin receives this, executes `figma.createFrame()` via the Figma Plugin API, and replies:
   ```json
   { "replyTo": "req_1", "result": { "ok": true, "nodeId": "123:456", "type": "FRAME", "name": "Login Page" } }
   ```
5. The extension resolves the promise and returns the result to the agent.

Each request has a 30-second timeout. If the plugin disconnects mid-operation, pending requests are rejected immediately.

## Troubleshooting

### "Figma plugin not connected"

- Make sure the Figma plugin is running (Plugins → Development → OpenClaw Figma Bridge).
- Check that the WebSocket address in `figma-plugin/ui.html` matches your OpenClaw server IP and port.
- Verify no firewall is blocking the bridge port.

### Plugin connects but operations fail

- Open the Figma plugin console (Plugins → Development → Open Console) to see error messages.
- Ensure you have a file open in Figma — the plugin operates on the current page.

### Read tools work but write tools don't

- Read tools use the REST API and don't need the plugin. Write tools require the plugin to be running and connected. Check `figma_bridge_status` to verify connectivity.

### Font errors on `figma_add_text`

- The font must be available in Figma. Default is `Inter` which is always available.
- For custom fonts, ensure they are installed or available in your Figma account.

## License

MIT
