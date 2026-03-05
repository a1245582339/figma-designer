# Best Practices

[中文版](./best-practices.zh-CN.md)

This guide covers proven strategies for getting the best results from `figma-designer-mcp`. These patterns come from real-world production usage and can significantly improve design quality, consistency, and cost efficiency.

## 1. Start with a Component Library File

**Don't work on a blank canvas.** Open a design system community file (e.g. [Ant Design Open Source](https://www.figma.com/community/file/831698976089873405)) and duplicate it to your Drafts. Then run the Figma plugin in that duplicated file.

Why this matters:

- The AI agent can use `figma_search_components` and `figma_find_nodes_all_pages` to discover pre-built components across all pages.
- Instead of drawing a button from scratch (create rectangle + add text + set border radius + set colors = 4+ tool calls), the agent just calls `figma_create_instance` with the component ID (1 tool call).
- Components come with proper Auto Layout, padding, and styling — no manual tweaking needed.
- **Result: 3–5x fewer tool calls, better visual quality, and design-system consistency.**

```
Workflow:
1. figma_search_components({ query: "Button" })
   → Returns componentId: "12:345", variants: Primary/Secondary/...
2. figma_create_instance({ componentId: "12:345", parentId: "card_id" })
   → Perfectly styled button placed inside your layout
```

## 2. Use a Template Frame

Create a **template frame** in your Figma file that represents the standard page layout — header, sidebar, content area, etc. Tell the AI agent to duplicate this template for every new page instead of building layouts from scratch.

Why this matters:

- Every page shares the same chrome (navigation, sidebar, header) automatically.
- The agent only needs to fill in the content area, not rebuild the entire page structure.
- Visual consistency is guaranteed across all pages.

```
Workflow:
1. figma_find_nodes({ nameContains: "Template" })
   → Find the template frame
2. figma_duplicate_node({ nodeId: "template_id" })
   → Create a copy for the new page
3. figma_find_nodes({ within: "copy_id", type: "TEXT", nameContains: "Title" })
   → Find the title placeholder
4. figma_set_text_content({ nodeId: "title_id", text: "User Management" })
   → Update the title
5. Design inside the content area of the copy
```

**Tip:** Define a Card or empty Frame inside the template as the designated "content canvas". Tell the agent that all design content goes inside this container. This prevents accidental modifications to the shared layout.

## 3. Duplicate Instead of Redraw (Copy-First Strategy)

When the design has **repetitive elements** — table rows, list items, card grids, form fields, navigation tabs — tell the agent to create one complete element, then duplicate it and modify the copies.

Why this matters:

- `figma_duplicate_node` takes 1 parameter (nodeId). Creating from scratch requires search → instantiate → get properties → set properties → modify text = 5+ calls.
- For N repeated items, this saves roughly `(N-1) × 4` tool calls.
- Duplicated elements inherit identical spacing, sizing, and styling.

```
Example — A table with 6 data rows:

❌ Bad: Create each row from scratch (6 × 5 = 30 tool calls)
✅ Good: Create 1 row, duplicate 5 times, update text (1×5 + 5×1 + 5×2 = ~20 tool calls)

Workflow:
1. Create the first row with full styling and content
2. figma_duplicate_node × 5 → five copies
3. For each copy:
   figma_find_nodes({ within: copy_id, type: "TEXT" })
   figma_set_text_content for each text node
```

**Applicable to:** Table rows, list items, card grids, form field groups, menu items, navigation tabs, breadcrumbs, timeline entries, and any repeated structure.

## 4. Configure Variants, Don't Redraw

Most design system components expose **variant properties** (size, type, state, number of items, etc.). Always configure components via their built-in properties instead of manually modifying internals.

Why this matters:

- Variant changes are atomic — one `figma_set_component_properties` call vs. multiple manual edits.
- The component maintains its internal structure, Auto Layout, and responsive behavior.
- You get design-system-correct results (proper padding, colors, states).

```
Workflow:
1. figma_create_instance({ componentId: "table_id", parentId: "card_id" })
2. figma_get_component_properties({ nodeId: "instance_id" })
   → { "Rows": { type: "VARIANT", value: "3", options: ["3","6","10"] },
       "Columns": { type: "VARIANT", value: "4", options: ["3","4","5","6"] },
       "Header": { type: "BOOLEAN", value: true } }
3. figma_set_component_properties({ nodeId: "instance_id",
     properties: { "Rows": "6", "Columns": "5" } })
   → Table now has 6 rows and 5 columns — properly aligned, spaced, styled
```

Common examples:

| Component | Useful Properties | Example |
|---|---|---|
| Button | Type, Size, Icon, Danger | `{ "Type": "Primary", "Size": "Large" }` |
| Input | Size, Status, Prefix/Suffix | `{ "Status": "Error" }` |
| Table | Rows, Columns | `{ "Rows": "6", "Columns": "5" }` |
| Select | Size, Mode | `{ "Mode": "Multiple" }` |
| Switch | Checked, Disabled | `{ "Checked": "true" }` |
| Tabs | Number of tabs, Type | Depends on component |

**Rule of thumb:** Always call `figma_get_component_properties` after instantiating a component to see what's configurable before resorting to manual edits.

## 5. Use Icons from the Library

If your Figma file includes an icon library (most design system files do), tell the agent to search and instantiate icons rather than drawing them.

```
Workflow:
1. figma_find_nodes_all_pages({ type: "COMPONENT", nameContains: "search" })
   → Find "SearchOutlined" icon in the Icon page
2. figma_create_instance({ componentId: "icon_id", parentId: "target_frame" })
```

This gives you crisp, consistent, correctly-sized icons instead of approximated shapes.

## 6. Use Auto Layout for Everything

Tell the agent to apply Auto Layout to container frames. This ensures proper spacing, alignment, and responsive behavior.

```
figma_set_auto_layout({
  nodeId: "container_id",
  layoutMode: "VERTICAL",
  itemSpacing: 16,
  paddingTop: 24, paddingBottom: 24,
  paddingLeft: 24, paddingRight: 24
})
```

Auto Layout makes it easy to add, remove, or reorder child elements without manually repositioning everything.

## 7. Use Default Fonts

Avoid specifying custom font families. Figma's default font (`Inter`) is always available and renders correctly. Custom fonts may not be installed and will cause errors.

## 8. Prompt Engineering Tips

### Be specific about components

```
❌ "Design a user list page"
✅ "Design a user list page using AntD Table (6 rows, 5 columns: Name, Email, Role, Status, Actions),
    with a search Input and a Primary Button at the top"
```

### Reference the template

```
❌ "Create a new page"
✅ "Duplicate the template frame, rename it to 'User List', and design inside the Card component"
```

### Mention the copy-first strategy

```
❌ "Add 8 menu items to the sidebar"
✅ "Create the first menu item, then duplicate it 7 times and update the text for each"
```

### Request variant configuration

```
❌ "Make the table bigger"
✅ "Set the Table component properties: Rows=8, Columns=6"
```

## Summary: Token Cost Optimization

| Technique | Estimated Savings | When to Use |
|---|---|---|
| Component library file | 3–5x fewer tool calls | Always |
| Template frame | ~50% fewer layout calls per page | Multi-page designs |
| Copy-first strategy | ~50% fewer calls for repeated items | Lists, tables, grids, menus |
| Variant configuration | 2–4x fewer calls vs. manual edits | Any configurable component |
| Icon library | ~80% fewer calls vs. drawing icons | Any icon usage |

These techniques compound. A typical page designed with all best practices applied uses **60–80% fewer tool calls** than a naive approach.
