# figma-designer-mcp

[![npm](https://img.shields.io/npm/v/figma-designer-mcp)](https://www.npmjs.com/package/figma-designer-mcp)
[![license](https://img.shields.io/npm/l/figma-designer-mcp)](./LICENSE)

让 AI 智能体拥有 Figma **完整读写能力**的 MCP 服务器 — 50+ 工具，涵盖创建画框、放置组件、设置样式、自动布局等。

兼容所有 MCP 客户端（Claude Desktop、Cursor、Continue 等），也可作为 [OpenClaw](#openclaw-模式) 扩展使用。

[English](./README.md) | 中文

![figma-designer-mcp 演示](https://github.com/a1245582339/picx-images-hosting/raw/master/ScreenShot_2026-03-06_092528_621.4ubhacbd2e.png)

- **读取** — 基于 Figma REST API（无需安装插件）。
- **写入** — 通过轻量 Figma 插件经 WebSocket 实时执行 Plugin API 操作。

## 与 Figma 官方 MCP 的区别

[Figma 官方 MCP 服务器](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server) 面向 **设计 → 代码** 方向：帮助开发者读取现有设计并生成代码。`figma-designer-mcp` 面向 **相反方向 — AI → 设计**：让 AI 智能体直接在 Figma 画布上 **创建和修改** 设计。

| | **figma-designer-mcp** | **Figma 官方 MCP** |
|---|---|---|
| **方向** | AI → 设计（创建和编辑设计稿） | 设计 → 代码（读取设计、生成代码） |
| **写入工具** | 44+ 写入工具 — 创建画框、图形、文本、放置组件、设置样式、自动布局等 | 几乎没有 — `generate_figma_design` 仅能截取实时 UI，无法创建或编辑设计元素 |
| **读取工具** | 6 个 REST API 工具 — 读取节点、截图、列出组件/样式、评论 | ~13 个工具 — 设计上下文、变量、元数据、截图、Code Connect |
| **组件操作** | 搜索、实例化、配置变体属性、复制、重新归属父级 | 只读 — 提取组件信息用于代码生成 |
| **页面与节点管理** | 创建/切换页面，重命名/删除/复制/编组/调整大小/旋转节点 | 无页面或节点操作能力 |
| **样式控制** | 填充、描边、圆角、透明度、混合模式、效果（阴影/模糊） | 无直接样式操作 — 仅返回样式数据供代码输出 |
| **自动布局** | 完整的 Auto Layout 配置（方向、间距、内边距、对齐、换行） | 无布局编辑能力 |
| **客户端支持** | 所有 MCP 客户端平等支持，无功能限制 | 部分功能仅限特定客户端（如 `generate_figma_design` 需要 Claude Code 或 Codex） |
| **部署方式** | 自托管、开源（MIT） | 远程（Figma 托管）或桌面应用 |
| **价格** | 免费 | 桌面服务器需付费 Figma 方案 |

**简言之：** Figma 官方 MCP 帮你把设计变成代码，`figma-designer-mcp` 帮 AI 把想法变成设计。两者互补，可以在同一项目中同时使用。

## 最佳实践

查看 **[最佳实践指南](./docs/best-practices.zh-CN.md)**，了解经过验证的策略：

- **使用组件库文件**（如 Ant Design）作为工作空间 — 搜索复用比从零绘制快 3–5 倍
- **创建模板 Frame** — 多页面设计时保持布局一致
- **复制代替重画** — 表格、列表、网格等重复元素，先创建一个再复制
- **配置变体属性** — 用组件自带配置代替手动修改内部结构
- **使用图标库** — 搜索并实例化，不要手绘图标

这些技巧叠加使用可减少 **60–80%** 的工具调用，同时节省时间和 Token。

## 快速开始

```bash
FIGMA_TOKEN=figd_xxxxxxxxxxxx npx figma-designer-mcp
```

或全局安装：

```bash
npm install -g figma-designer-mcp
FIGMA_TOKEN=figd_xxxxxxxxxxxx figma-designer-mcp
```

### 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `FIGMA_TOKEN` | 是 | Figma 个人访问令牌（[在此生成](https://www.figma.com/developers/api#access-tokens)） |
| `FIGMA_BRIDGE_PORT` | 否 | WebSocket 桥接端口（默认：`3055`） |

### Claude Desktop

添加到 `claude_desktop_config.json`：

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

添加到 `.cursor/mcp.json`：

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

### 其他 MCP 客户端

任何支持 MCP stdio 传输的客户端均可使用：

```json
{
  "command": "npx",
  "args": ["figma-designer-mcp"],
  "env": { "FIGMA_TOKEN": "figd_xxxxxxxxxxxx" }
}
```

## Figma 插件安装（写入工具需要）

读取工具开箱即用。写入工具（创建节点、设置样式、自动布局等）需要配套的 Figma 插件作为执行桥梁。

### 1. 构建插件

```bash
cd /path/to/figma-designer-mcp
npm run build:plugin
```

将 `figma-plugin/src/plugin.ts` 编译为 `figma-plugin/plugin.js`（使用 esbuild）。

### 2. 导入 Figma

1. 打开 **Figma**（桌面应用或浏览器）。
2. 进入 **Plugins → Development → Import plugin from manifest…**
3. 选择包目录下的 `figma-plugin/manifest.json`。
4. 打开你要设计的 Figma 文件。
5. 运行插件：**Plugins → Development → OpenClaw Figma Bridge**。

插件会打开一个配置界面，输入 MCP 服务器地址和端口，点击 **Connect** 即可。配置会通过 Figma 的 `clientStorage` 持久化保存，断线后自动重连。

> **提示：** 复制一个设计系统社区文件（如 [Ant Design Open Source](https://www.figma.com/community/file/831698976089873405)），打开副本并运行插件。AI 智能体就可以用 `figma_search_components` 搜索组件并用 `figma_create_instance` 放置组件了。

## 架构

```
AI 客户端（Claude、Cursor 等）
  │  MCP stdio 传输
  ▼
figma-designer-mcp
  ├── REST API 客户端  →  Figma API（读取、截图、组件、样式、评论）
  └── WebSocket 服务器（FigmaBridge，默认端口 3055）
                              ▼
               Figma 客户端（桌面或浏览器）
                 └── "OpenClaw Figma Bridge" 插件
                     └── 执行 Plugin API 调用（创建节点、设置样式、自动布局…）
```

### 读取路径

智能体调用 `figma_read` / `figma_screenshot` 等 → MCP 服务器使用 `FIGMA_TOKEN` 向 `https://api.figma.com/v1/...` 发起 HTTP 请求 → 返回结构化数据。

### 写入路径

1. MCP 服务器在端口 `FIGMA_BRIDGE_PORT`（默认 `3055`）启动 WebSocket 服务。
2. Figma 插件连接到此 WebSocket 服务。
3. 当智能体调用写入工具（如 `figma_create_frame`）时，服务器发送 JSON 消息：
   ```json
   { "id": "req_1", "action": "create_frame", "args": { "name": "登录页面", "width": 1440, "height": 900 } }
   ```
4. 插件通过 Plugin API 执行 `figma.createFrame()` 并回复：
   ```json
   { "replyTo": "req_1", "result": { "ok": true, "nodeId": "123:456", "type": "FRAME", "name": "登录页面" } }
   ```
5. 服务器解析 Promise 并将结果返回给智能体。

每个请求有 30 秒超时。如果插件在操作过程中断开，待处理的请求会立即被拒绝。

### 自动定位

所有创建工具在以下条件下会自动将新的顶层元素放置到现有内容的右侧：
1. 未指定 `parentId`（放置在页面根层级）
2. 未提供明确的 `x` 或 `y` 坐标

这可以防止元素重叠。放置在 Frame 内部（通过 `parentId`）的元素不受影响。

## 可用工具

### 读取工具（REST API — 无需插件）

| 工具 | 说明 |
|---|---|
| `figma_read` | 读取 Figma 文件或特定节点。返回包含布局、样式和文本信息的节点树。 |
| `figma_screenshot` | 将节点导出为图片（PNG、JPG、SVG、PDF）。返回下载链接。 |
| `figma_components` | 列出文件中所有组件（名称、描述、键值、节点 ID）。 |
| `figma_styles` | 列出文件中所有样式（颜色、文本样式、效果、网格）。 |
| `figma_comment` | 在文件上发表评论，可选择关联到特定节点。 |
| `figma_get_comments` | 读取文件上的所有评论。返回文本、作者、时间戳。 |

### 写入工具（WebSocket 桥接 — 需要插件）

#### 创建

| 工具 | 说明 |
|---|---|
| `figma_create_frame` | 创建画框（画板）。参数：`name`、`width`、`height`、`x`、`y`、`parentId`。 |
| `figma_create_rectangle` | 创建矩形。参数：`width`、`height`、`x`、`y`、`cornerRadius`、`hex`、`parentId`。 |
| `figma_create_ellipse` | 创建椭圆/圆形。参数：`width`、`height`、`x`、`y`、`hex`、`parentId`。 |
| `figma_create_line` | 创建线条。参数：`length`、`x`、`y`、`rotation`、`strokeHex`、`strokeWeight`、`parentId`。 |
| `figma_create_polygon` | 创建多边形。参数：`sides`、`width`、`height`、`x`、`y`、`hex`、`parentId`。 |
| `figma_create_star` | 创建星形。参数：`points`、`width`、`height`、`x`、`y`、`hex`、`parentId`。 |
| `figma_add_text` | 添加文本节点。参数：`text`、`x`、`y`、`fontFamily`、`fontStyle`、`fontSize`、`hex`、`parentId`。 |
| `figma_place_image` | 放置 base64 图片。参数：`base64`、`width`、`height`、`x`、`y`、`parentId`。 |

#### 查找与选择

| 工具 | 说明 |
|---|---|
| `figma_find_nodes` | 按类型或名称在当前页面查找节点。参数：`type`、`nameContains`、`within`。 |
| `figma_find_nodes_all_pages` | 跨 **所有页面** 按类型和/或名称搜索节点。返回节点 ID、类型、名称和所在页面。参数：`type`、`nameContains`、`nameEquals`、`limit`。 |
| `figma_select_nodes` | 按 ID 选择节点。参数：`nodeIds`。 |
| `figma_get_selection` | 获取当前选中内容。 |

#### 页面管理

| 工具 | 说明 |
|---|---|
| `figma_list_pages` | 列出文件中所有页面的 ID 和名称，并显示当前活动页面。 |
| `figma_create_page` | 创建新页面。参数：`name`、`makeCurrent`。 |
| `figma_set_current_page` | 切换到指定页面。参数：`pageId`。 |
| `figma_get_page_bounds` | 获取当前页面所有内容的边界框，以及放置新元素的建议位置（避免重叠）。 |

#### 节点管理

| 工具 | 说明 |
|---|---|
| `figma_rename_node` | 重命名节点。参数：`nodeId`、`name`。 |
| `figma_delete_node` | 删除节点。参数：`nodeId`。 |
| `figma_duplicate_node` | 复制节点。参数：`nodeId`、`x`、`y`。 |
| `figma_resize_node` | 调整节点大小。参数：`nodeId`、`width`、`height`。 |
| `figma_rotate_node` | 旋转节点。参数：`nodeId`、`rotation`。 |
| `figma_set_position` | 设置绝对位置。参数：`nodeId`、`x`、`y`。 |
| `figma_group_nodes` | 编组节点。参数：`nodeIds`、`name`。 |
| `figma_ungroup` | 取消编组。参数：`groupId`。 |
| `figma_reparent_node` | 将节点移动到不同容器（画框、编组、页面）。参数：`nodeId`、`newParentId`、`index`。 |

#### 样式

| 工具 | 说明 |
|---|---|
| `figma_set_fill` | 设置填充颜色。参数：`nodeId`、`hex`、`opacity`。 |
| `figma_set_stroke` | 设置描边。参数：`nodeId`、`hex`、`opacity`、`strokeWeight`、`strokeAlign`、`dashPattern`、`cap`、`join`。 |
| `figma_set_corner_radius` | 设置圆角（统一或逐角）。参数：`nodeId`、`radius`、`topLeft`、`topRight`、`bottomRight`、`bottomLeft`。 |
| `figma_set_opacity` | 设置透明度（0–1）。参数：`nodeId`、`opacity`。 |
| `figma_set_blend_mode` | 设置混合模式。参数：`nodeId`、`mode`。 |
| `figma_add_effect` | 添加阴影或模糊。参数：`nodeId`、`type`、`radius`、`spread`、`hex`、`opacity`、`offsetX`、`offsetY`。 |
| `figma_clear_effects` | 移除所有效果。参数：`nodeId`。 |

#### 布局

| 工具 | 说明 |
|---|---|
| `figma_set_auto_layout` | 配置 Auto Layout。参数：`nodeId`、`layoutMode`、`itemSpacing`、`padding*`、`primaryAxisAlignItems`、`counterAxisAlignItems`、`layoutWrap` 等。 |
| `figma_set_constraints` | 设置约束。参数：`nodeId`、`horizontal`、`vertical`。 |
| `figma_layout_grid_add` | 添加布局网格。参数：`nodeId`、`pattern`、`count`、`gutterSize`、`sectionSize`、`hex`、`opacity`。 |
| `figma_layout_grid_clear` | 移除所有布局网格。参数：`nodeId`。 |

#### 文本编辑

| 工具 | 说明 |
|---|---|
| `figma_set_text_content` | 修改文本内容。参数：`nodeId`、`text`。 |
| `figma_set_text_style` | 应用文本样式。参数：`nodeId`、`fontFamily`、`fontStyle`、`fontSize`、`lineHeight`、`letterSpacing`、`textAlignHorizontal`、`textAutoResize`。 |
| `figma_set_text_color` | 设置文本颜色。参数：`nodeId`、`hex`、`opacity`。 |

#### 组件与布尔运算

| 工具 | 说明 |
|---|---|
| `figma_create_component` | 创建可复用组件。参数：`name`、`fromNodeIds`。 |
| `figma_create_instance` | 实例化组件。参数：`componentId`、`x`、`y`、`parentId`。 |
| `figma_detach_instance` | 将实例分离为普通画框。参数：`nodeId`。 |
| `figma_boolean_op` | 布尔运算（UNION、SUBTRACT、INTERSECT、EXCLUDE）。参数：`op`、`nodeIds`、`name`。 |

#### 组件库

| 工具 | 说明 |
|---|---|
| `figma_list_local_components` | 列出文件中所有组件。参数：`pageFilter`（可选，按页面名称过滤）、`limit`（默认 200）。返回组件名称、ID、变体属性和页面位置。 |
| `figma_search_components` | 按名称、组件集名称或描述搜索组件。参数：`query`、`limit`（默认 50）。 |
| `figma_get_component_properties` | 读取组件实例的所有可配置属性（变体、布尔值、文本覆盖）。返回属性名称、类型、当前值和可用选项。参数：`nodeId`。 |
| `figma_set_component_properties` | 设置组件实例的变体属性（如 Table 的行/列数、Button 的类型/大小）。支持属性名模糊匹配。参数：`nodeId`、`properties`。 |

#### 导出与工具

| 工具 | 说明 |
|---|---|
| `figma_export_node` | 通过插件导出节点为 PNG/JPG/SVG。参数：`nodeId`、`format`、`scale`。 |
| `figma_set_properties` | 批量设置多个属性。参数：`nodeId`、`props`。 |
| `figma_bridge_status` | 检查 Figma 插件是否已连接。 |

## 开发

### 构建

```bash
npm run build           # 构建全部（插件 + MCP 服务器）
npm run build:plugin    # 仅构建 Figma 插件
npm run build:mcp       # 仅构建 MCP 服务器
```

- `build:plugin` 编译 `figma-plugin/src/plugin.ts` → `figma-plugin/plugin.js`（IIFE、ES2015、浏览器环境）
- `build:mcp` 编译 `mcp-server.ts` → `dist/mcp-server.js`（ESM、Node 18+）

修改 `plugin.ts` 后需要重新构建并在 Figma 中重启插件。

### 添加新工具

1. 在 `src/tool-defs.ts` 中添加工具定义（OpenClaw 和 MCP 模式的唯一数据源）。
2. **桥接工具（写入）：** 在 `figma-plugin/src/plugin.ts` 中添加 action 处理器。在 `tool-defs.ts` 中使用 `bt()` 辅助函数定义工具。
3. **REST API 工具（读取）：** 在 `src/client.ts` 中添加客户端方法，在 `tool-defs.ts` 中编写自定义执行函数。

### 项目结构

```
figma-designer-mcp/
├── mcp-server.ts             # MCP 服务器入口
├── index.ts                  # OpenClaw 插件入口（替代模式）
├── openclaw.plugin.json      # OpenClaw 插件清单
├── package.json
├── LICENSE
├── src/
│   ├── tool-defs.ts          # 共享工具定义（唯一数据源）
│   ├── client.ts             # Figma REST API 客户端（读取操作）
│   ├── tools.ts              # OpenClaw 适配器 — 读取工具
│   ├── write-tools.ts        # OpenClaw 适配器 — 写入工具
│   └── bridge.ts             # WebSocket 服务器 — 接受 Figma 插件连接
├── dist/                     # 构建输出
│   └── mcp-server.js         # 编译后的 MCP 服务器（由 npm run build:mcp 生成）
├── figma-plugin/             # Figma 插件（导入 Figma 以启用写入操作）
│   ├── manifest.json
│   ├── ui.html               # 插件 UI — 服务器配置与 WebSocket 客户端
│   ├── src/
│   │   └── plugin.ts         # TypeScript 源码（action 分发器）
│   ├── plugin.js             # 编译输出（由 npm run build:plugin 生成）
│   ├── tsconfig.json
│   └── assets/
│       └── logo.jpeg
└── .gitignore
```

## 常见问题

### "Figma plugin not connected"

- 确保 Figma 插件正在运行（Plugins → Development → OpenClaw Figma Bridge）。
- 检查插件 UI 中的 WebSocket 地址是否与服务器 IP 和端口匹配。
- 确认防火墙没有阻止桥接端口。

### 插件已连接但操作失败

- 打开 Figma 插件控制台（Plugins → Development → Open Console）查看错误信息。
- 确保 Figma 中已打开文件 — 插件在当前页面上操作。

### 读取工具正常但写入工具不工作

- 读取工具使用 REST API，不需要插件。写入工具需要插件运行并连接。使用 `figma_bridge_status` 检查连接状态。

### `figma_add_text` 字体错误

- 字体必须在 Figma 中可用。默认字体 `Inter` 始终可用。
- 自定义字体需确保已安装或在你的 Figma 账户中可用。

## OpenClaw 模式

本包也可作为 OpenClaw 扩展使用。如需在 OpenClaw 中使用（而非独立 MCP 服务器）：

### 前提条件

| 要求 | 详情 |
|---|---|
| **OpenClaw** | 网关运行中，且已启用 `figma-designer` 插件 |
| **Figma 个人访问令牌** | 在 https://www.figma.com/developers/api#access-tokens 生成 |
| **Figma 桌面或浏览器** | 写入操作需要 |

### 配置

添加到 `openclaw.json`：

```jsonc
{
  "plugins": {
    "entries": {
      "figma-designer": {
        "enabled": true,
        "config": {
          "personalAccessToken": "figd_xxxxxxxxxxxx",
          "bridgePort": 3055          // 可选，默认 3055
        }
      }
    }
  }
}
```

更新配置后需重启 OpenClaw 网关。

## 许可证

MIT — 详见 [LICENSE](./LICENSE)。
