# 最佳实践

[English](./best-practices.md)

本指南涵盖了经过实际生产验证的策略，帮助你从 `figma-designer-mcp` 获得最佳效果。这些模式可以显著提升设计质量、一致性和成本效率。

## 1. 使用组件库文件作为工作空间

**不要在空白画布上工作。** 打开一个设计系统社区文件（如 [Ant Design Open Source](https://www.figma.com/community/file/831698976089873405)），复制到你的 Drafts，然后在副本中运行 Figma 插件。

为什么这很重要：

- AI 智能体可以用 `figma_search_components` 和 `figma_find_nodes_all_pages` 搜索所有页面中的预制组件。
- 与其从零画一个按钮（创建矩形 + 添加文字 + 设置圆角 + 设置颜色 = 4+ 次工具调用），智能体只需调用 `figma_create_instance` 传入组件 ID（1 次工具调用）。
- 组件自带正确的 Auto Layout、内边距和样式，无需手动调整。
- **效果：工具调用减少 3–5 倍，视觉质量更好，设计系统一致性更强。**

```
工作流：
1. figma_search_components({ query: "Button" })
   → 返回 componentId: "12:345"，变体: Primary/Secondary/...
2. figma_create_instance({ componentId: "12:345", parentId: "card_id" })
   → 一个样式完美的按钮就放进了你的布局中
```

## 2. 使用模板 Frame

在 Figma 文件中创建一个**模板 Frame**，包含标准页面布局 — 顶栏、侧边栏、内容区等。告诉 AI 智能体每创建一个新页面都要**复制**这个模板，而不是从头搭建布局。

为什么这很重要：

- 每个页面自动共享相同的外壳（导航、侧边栏、顶栏）。
- 智能体只需要填充内容区，不用每次都重建整个页面结构。
- 所有页面的视觉一致性有保障。

```
工作流：
1. figma_find_nodes({ nameContains: "模板" })
   → 找到模板 Frame
2. figma_duplicate_node({ nodeId: "template_id" })
   → 为新页面创建副本
3. figma_find_nodes({ within: "copy_id", type: "TEXT", nameContains: "需求名称" })
   → 找到标题占位符
4. figma_set_text_content({ nodeId: "title_id", text: "用户管理" })
   → 更新标题
5. 在副本的内容区域内进行设计
```

**提示：** 在模板内部放一个 Card 或空白 Frame 作为指定的"内容画布"。告诉智能体所有设计内容都放在这个容器内。这可以防止误改共享布局。

## 3. 复制代替重画（复制优先策略）

当设计中包含**重复元素** — 表格行、列表项、卡片网格、表单字段、导航标签 — 告诉智能体先完整创建一个元素，然后复制并修改副本的内容。

为什么这很重要：

- `figma_duplicate_node` 只需 1 个参数（nodeId）。从零创建需要搜索 → 实例化 → 获取属性 → 设置属性 → 修改文字 = 5+ 次调用。
- 对于 N 个重复项，大约节省 `(N-1) × 4` 次工具调用。
- 复制出的元素继承相同的间距、尺寸和样式。

```
示例 — 一个包含 6 行数据的表格：

❌ 差：逐行从零创建（6 × 5 = 30 次工具调用）
✅ 好：创建 1 行，复制 5 次，更新文字（1×5 + 5×1 + 5×2 = ~20 次工具调用）

工作流：
1. 完整创建第一行（包含样式和内容）
2. figma_duplicate_node × 5 → 五个副本
3. 对每个副本：
   figma_find_nodes({ within: copy_id, type: "TEXT" })
   figma_set_text_content 逐个修改文字
```

**适用于：** 表格行、列表项、卡片网格、表单字段组、菜单项、导航标签、面包屑、时间线条目，以及任何重复结构。

## 4. 配置变体，而非手动重绘

大多数设计系统组件都暴露了**变体属性**（大小、类型、状态、数量等）。始终通过组件内建属性配置组件，而不是手动修改其内部结构。

为什么这很重要：

- 变体变更是原子操作 — 一次 `figma_set_component_properties` 调用 vs. 多次手动编辑。
- 组件保持其内部结构、Auto Layout 和响应式行为不变。
- 你得到的是设计系统级别的正确结果（合理的内边距、颜色、状态）。

```
工作流：
1. figma_create_instance({ componentId: "table_id", parentId: "card_id" })
2. figma_get_component_properties({ nodeId: "instance_id" })
   → { "Rows": { type: "VARIANT", value: "3", options: ["3","6","10"] },
       "Columns": { type: "VARIANT", value: "4", options: ["3","4","5","6"] },
       "Header": { type: "BOOLEAN", value: true } }
3. figma_set_component_properties({ nodeId: "instance_id",
     properties: { "Rows": "6", "Columns": "5" } })
   → 表格变为 6 行 5 列 — 对齐、间距、样式全部正确
```

常见示例：

| 组件 | 常用属性 | 示例 |
|---|---|---|
| Button | Type、Size、Icon、Danger | `{ "Type": "Primary", "Size": "Large" }` |
| Input | Size、Status、Prefix/Suffix | `{ "Status": "Error" }` |
| Table | Rows、Columns | `{ "Rows": "6", "Columns": "5" }` |
| Select | Size、Mode | `{ "Mode": "Multiple" }` |
| Switch | Checked、Disabled | `{ "Checked": "true" }` |
| Tabs | 标签数量、Type | 视组件而定 |

**经验法则：** 实例化组件后，始终先调用 `figma_get_component_properties` 查看可配置项，再考虑手动修改。

## 5. 使用图标库

如果你的 Figma 文件包含图标库（大多数设计系统文件都有），告诉智能体搜索并实例化图标，而不是手动绘制。

```
工作流：
1. figma_find_nodes_all_pages({ type: "COMPONENT", nameContains: "search" })
   → 在 Icon 页面找到 "SearchOutlined" 图标
2. figma_create_instance({ componentId: "icon_id", parentId: "target_frame" })
```

这样得到的图标清晰、一致、尺寸正确，不会是近似的手绘图形。

## 6. 所有容器都用 Auto Layout

告诉智能体对容器 Frame 设置 Auto Layout。这能确保正确的间距、对齐和响应式行为。

```
figma_set_auto_layout({
  nodeId: "container_id",
  layoutMode: "VERTICAL",
  itemSpacing: 16,
  paddingTop: 24, paddingBottom: 24,
  paddingLeft: 24, paddingRight: 24
})
```

Auto Layout 使得添加、删除或重排子元素变得容易，无需手动重新定位每个元素。

## 7. 使用默认字体

避免指定自定义字体。Figma 默认字体（`Inter`）始终可用且渲染正确。自定义字体可能未安装，会导致错误。

## 8. 提示词技巧

### 明确指定组件

```
❌ "设计一个用户列表页面"
✅ "设计一个用户列表页面，使用 AntD Table（6行5列：姓名、邮箱、角色、状态、操作），
    顶部放一个搜索 Input 和一个 Primary Button"
```

### 引用模板

```
❌ "创建一个新页面"
✅ "复制模板 Frame，重命名为'用户列表'，在 Card 组件内部进行设计"
```

### 提及复制优先策略

```
❌ "在侧边栏添加 8 个菜单项"
✅ "创建第一个菜单项，然后复制 7 次，分别修改每个的文字"
```

### 要求配置变体

```
❌ "让表格变大一点"
✅ "设置 Table 组件属性：Rows=8、Columns=6"
```

## 总结：Token 成本优化

| 技巧 | 预估节省 | 适用场景 |
|---|---|---|
| 组件库文件 | 工具调用减少 3–5 倍 | 始终使用 |
| 模板 Frame | 每页布局调用减少 ~50% | 多页面设计 |
| 复制优先策略 | 重复元素调用减少 ~50% | 列表、表格、网格、菜单 |
| 变体配置 | 比手动编辑减少 2–4 倍调用 | 任何可配置组件 |
| 图标库 | 比手绘图标减少 ~80% 调用 | 任何图标使用 |

这些技巧可以叠加。应用所有最佳实践的典型页面比原始方式减少 **60–80% 的工具调用**。
