figma.showUI(__html__, { visible: false });

figma.ui.onmessage = async (msg: {
  _status?: string;
  id?: string;
  action?: string;
  args?: Record<string, any>;
}) => {
  if (msg._status) return;
  const { id, action, args } = msg;
  try {
    const result = await handleAction(action!, args || {});
    reply(id!, { ok: true, ...result });
  } catch (e) {
    reply(id!, { ok: false }, e instanceof Error ? e.message : String(e));
  }
};

function reply(replyTo: string, result: Record<string, any>, error?: string) {
  figma.ui.postMessage({ replyTo, result, error });
}

const page = () => figma.currentPage;

// ── Utilities ──

function hexToRGB(hex: string): RGB {
  const v = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(v)) throw new Error("Invalid hex color: " + hex);
  return {
    r: parseInt(v.slice(0, 2), 16) / 255,
    g: parseInt(v.slice(2, 4), 16) / 255,
    b: parseInt(v.slice(4, 6), 16) / 255,
  };
}

function getNode(id: string): SceneNode {
  const n = figma.getNodeById(id);
  if (!n) throw new Error("Node not found: " + id);
  return n as SceneNode;
}

function assertFills(n: SceneNode): asserts n is SceneNode & MinimalFillsMixin {
  if (!("fills" in n)) throw new Error("Node does not support fills");
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function nodeInfo(n: BaseNode) {
  return { nodeId: n.id, type: n.type, name: "name" in n ? n.name : undefined };
}

function cloneArray<T>(arr: ReadonlyArray<T>): T[] {
  const out: T[] = [];
  for (let i = 0; i < arr.length; i++) out.push(arr[i]);
  return out;
}

// ── Action dispatcher ──

async function handleAction(action: string, input: Record<string, any>): Promise<Record<string, any>> {
  switch (action) {
    case "create_frame":        return createFrame(input);
    case "create_rectangle":    return createRectangle(input);
    case "create_ellipse":      return createEllipse(input);
    case "create_line":         return createLine(input);
    case "create_polygon":      return createPolygon(input);
    case "create_star":         return createStar(input);
    case "add_text":            return addText(input);
    case "place_image_base64":  return placeImageBase64(input);

    case "find_nodes":          return findNodes(input);
    case "select_nodes":        return selectNodes(input);
    case "get_selection":       return getSelection();
    case "create_page":         return createPage(input);
    case "set_current_page":    return setCurrentPage(input);

    case "rename_node":         return renameNode(input);
    case "delete_node":         return deleteNode(input);
    case "duplicate_node":      return duplicateNode(input);
    case "resize_node":         return resizeNode(input);
    case "rotate_node":         return rotateNode(input);
    case "set_position":        return setPosition(input);
    case "group_nodes":         return groupNodes(input);
    case "ungroup":             return ungroupNode(input);

    case "set_fill":            return setFill(input);
    case "set_stroke":          return setStroke(input);
    case "set_corner_radius":   return setCornerRadius(input);
    case "set_opacity":         return setOpacity(input);
    case "set_blend_mode":      return setBlendMode(input);
    case "add_effect":          return addEffect(input);
    case "clear_effects":       return clearEffects(input);
    case "layout_grid_add":     return layoutGridAdd(input);
    case "layout_grid_clear":   return layoutGridClear(input);

    case "set_auto_layout":     return setAutoLayout(input);
    case "set_constraints":     return setConstraints(input);

    case "set_text_content":    return setTextContent(input);
    case "set_text_style":      return setTextStyle(input);
    case "set_text_color":      return setTextColor(input);

    case "create_component":    return createComponent(input);
    case "create_instance":     return createInstance(input);
    case "detach_instance":     return detachInstance(input);
    case "boolean_op":          return booleanOp(input);

    case "export_node":         return exportNode(input);
    case "set_plugin_data":     return setPluginData(input);
    case "get_plugin_data":     return getPluginData(input);
    case "set_properties":      return setProperties(input);

    default:
      throw new Error("Unknown action: " + action);
  }
}

// ── Create ──

function getParent(parentId?: string): BaseNode & ChildrenMixin {
  if (parentId) return getNode(parentId) as BaseNode & ChildrenMixin;
  return page();
}

function createFrame({ name = "Frame", width = 800, height = 600, x = 0, y = 0, parentId }: any) {
  const f = figma.createFrame();
  f.name = name; f.resize(width, height); f.x = x; f.y = y;
  getParent(parentId).appendChild(f);
  return { nodeId: f.id, type: f.type, name: f.name, width, height };
}

function createRectangle({ width, height, x = 0, y = 0, cornerRadius, hex, parentId }: any) {
  const r = figma.createRectangle();
  r.resize(width, height); r.x = x; r.y = y;
  if (typeof cornerRadius === "number") r.cornerRadius = cornerRadius;
  if (hex) r.fills = [{ type: "SOLID", color: hexToRGB(hex) }];
  getParent(parentId).appendChild(r);
  return { nodeId: r.id, type: r.type };
}

function createEllipse({ width, height, x = 0, y = 0, hex, parentId }: any) {
  const e = figma.createEllipse();
  e.resize(width, height); e.x = x; e.y = y;
  if (hex) e.fills = [{ type: "SOLID", color: hexToRGB(hex) }];
  getParent(parentId).appendChild(e);
  return { nodeId: e.id, type: e.type };
}

function createLine({ x = 0, y = 0, length = 100, rotation = 0, strokeHex = "#111827", strokeWeight = 1, parentId }: any) {
  const l = figma.createLine();
  l.x = x; l.y = y; l.rotation = rotation;
  l.strokes = [{ type: "SOLID", color: hexToRGB(strokeHex) }];
  l.strokeWeight = strokeWeight;
  l.resize(length, 0);
  getParent(parentId).appendChild(l);
  return { nodeId: l.id, type: l.type };
}

function createPolygon({ sides, width, height, x = 0, y = 0, hex, parentId }: any) {
  const p = figma.createPolygon();
  p.pointCount = sides; p.resize(width, height); p.x = x; p.y = y;
  if (hex) p.fills = [{ type: "SOLID", color: hexToRGB(hex) }];
  getParent(parentId).appendChild(p);
  return { nodeId: p.id, type: p.type };
}

function createStar({ points, width, height, x = 0, y = 0, hex, parentId }: any) {
  const s = figma.createStar();
  s.pointCount = points; s.resize(width, height); s.x = x; s.y = y;
  if (hex) s.fills = [{ type: "SOLID", color: hexToRGB(hex) }];
  getParent(parentId).appendChild(s);
  return { nodeId: s.id, type: s.type };
}

async function addText({ text, x = 0, y = 0, fontFamily = "Inter", fontStyle = "Regular", fontSize = 32, hex, parentId }: any) {
  await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
  const t = figma.createText();
  t.characters = text;
  t.fontName = { family: fontFamily, style: fontStyle };
  if (fontSize) t.fontSize = fontSize;
  if (hex) t.fills = [{ type: "SOLID", color: hexToRGB(hex) }];
  t.x = x; t.y = y;
  getParent(parentId).appendChild(t);
  return { nodeId: t.id, type: t.type, text: t.characters };
}

function placeImageBase64({ width, height, x = 0, y = 0, base64, parentId }: any) {
  const bytes = base64ToUint8Array(base64);
  const image = figma.createImage(bytes);
  const r = figma.createRectangle();
  r.resize(width, height); r.x = x; r.y = y;
  r.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
  getParent(parentId).appendChild(r);
  return { nodeId: r.id, type: r.type };
}

// ── Selection / find / pages ──

function findNodes({ type, nameContains, within }: any) {
  const scope = within ? getNode(within) : page();
  if (!("findAll" in scope)) throw new Error("Invalid scope");
  const nodes = (scope as ChildrenMixin).findAll((n: SceneNode) => {
    const typeOk = type ? n.type === type : true;
    const nameOk = nameContains
      ? "name" in n && String(n.name).toLowerCase().includes(nameContains.toLowerCase())
      : true;
    return typeOk && nameOk;
  });
  return nodes.map(nodeInfo);
}

function selectNodes({ nodeIds }: any) {
  const nodes = (nodeIds as string[]).map(getNode).filter(Boolean);
  figma.currentPage.selection = nodes;
  return { selected: nodes.map((n: SceneNode) => n.id) };
}

function getSelection() {
  return figma.currentPage.selection.map(nodeInfo);
}

function createPage({ name = "Page", makeCurrent = true }: any) {
  const p = figma.createPage();
  p.name = name;
  if (makeCurrent) figma.currentPage = p;
  return { pageId: p.id, name: p.name };
}

function setCurrentPage({ pageId }: any) {
  const p = figma.getNodeById(pageId);
  if (!p || p.type !== "PAGE") throw new Error("Not a page");
  figma.currentPage = p as PageNode;
  return { pageId: p.id };
}

// ── Node management ──

function renameNode({ nodeId, name }: any) {
  const n = getNode(nodeId);
  if ("name" in n) (n as any).name = name;
  return nodeInfo(n);
}

function deleteNode({ nodeId }: any) {
  getNode(nodeId).remove();
  return { removed: nodeId };
}

function duplicateNode({ nodeId, x, y }: any) {
  const n = getNode(nodeId);
  const copy = n.clone();
  if (typeof x === "number") copy.x = x;
  if (typeof y === "number") copy.y = y;
  if (n.parent) (n.parent as ChildrenMixin).appendChild(copy);
  return nodeInfo(copy);
}

function resizeNode({ nodeId, width, height }: any) {
  const n = getNode(nodeId);
  if (!("resize" in n)) throw new Error("Node cannot be resized");
  (n as any).resize(width, height);
  return nodeInfo(n);
}

function rotateNode({ nodeId, rotation }: any) {
  const n = getNode(nodeId);
  if (!("rotation" in n)) throw new Error("No rotation on node");
  (n as any).rotation = rotation;
  return nodeInfo(n);
}

function setPosition({ nodeId, x, y }: any) {
  const n = getNode(nodeId);
  n.x = x; n.y = y;
  return nodeInfo(n);
}

function groupNodes({ nodeIds, name = "Group" }: any) {
  const nodes = (nodeIds as string[]).map(getNode).filter((n: SceneNode) => "visible" in n);
  if (nodes.length < 2) throw new Error("Need 2+ nodes");
  const parent = nodes[0].parent || page();
  const g = figma.group(nodes, parent as BaseNode & ChildrenMixin);
  g.name = name;
  return nodeInfo(g);
}

function ungroupNode({ groupId }: any) {
  const g = getNode(groupId);
  if (g.type !== "GROUP") throw new Error("Not a group");
  const parent = g.parent || page();
  const children = cloneArray((g as GroupNode).children);
  for (const c of children) (parent as ChildrenMixin).appendChild(c);
  g.remove();
  return { released: children.map((c: SceneNode) => c.id) };
}

// ── Styling ──

function setFill({ nodeId, hex, opacity }: any) {
  const n = getNode(nodeId);
  assertFills(n);
  const fill: SolidPaint = { type: "SOLID", color: hexToRGB(hex), opacity: typeof opacity === "number" ? Math.max(0, Math.min(1, opacity)) : 1 };
  n.fills = [fill];
  return nodeInfo(n);
}

function setStroke({ nodeId, hex, opacity, strokeWeight, strokeAlign, dashPattern, cap, join }: any) {
  const n = getNode(nodeId);
  if (!("strokes" in n)) throw new Error("Node does not support strokes");
  const s: SolidPaint = { type: "SOLID", color: hexToRGB(hex), opacity: typeof opacity === "number" ? Math.max(0, Math.min(1, opacity)) : 1 };
  (n as MinimalStrokesMixin).strokes = [s];
  if (strokeWeight != null) (n as any).strokeWeight = strokeWeight;
  if (strokeAlign) (n as any).strokeAlign = strokeAlign;
  if (dashPattern) (n as any).dashPattern = dashPattern;
  if (cap) (n as any).strokeCap = cap;
  if (join) (n as any).strokeJoin = join;
  return nodeInfo(n);
}

function setCornerRadius({ nodeId, radius, topLeft, topRight, bottomRight, bottomLeft }: any) {
  const n = getNode(nodeId) as any;
  if ("cornerRadius" in n && typeof radius === "number") n.cornerRadius = radius;
  if ("topLeftRadius" in n) {
    if (typeof topLeft === "number") n.topLeftRadius = topLeft;
    if (typeof topRight === "number") n.topRightRadius = topRight;
    if (typeof bottomRight === "number") n.bottomRightRadius = bottomRight;
    if (typeof bottomLeft === "number") n.bottomLeftRadius = bottomLeft;
  }
  return nodeInfo(n);
}

function setOpacity({ nodeId, opacity }: any) {
  const n = getNode(nodeId) as any;
  n.opacity = Math.max(0, Math.min(1, opacity));
  return nodeInfo(n);
}

function setBlendMode({ nodeId, mode }: any) {
  const n = getNode(nodeId) as any;
  n.blendMode = mode;
  return nodeInfo(n);
}

function addEffect({ nodeId, type, radius = 8, spread = 0, hex = "#000000", opacity = 0.25, offsetX = 0, offsetY = 2 }: any) {
  const n = getNode(nodeId) as SceneNode & BlendMixin;
  if (!("effects" in n)) throw new Error("Node does not support effects");
  const effects = cloneArray(n.effects);
  if (type === "LAYER_BLUR" || type === "BACKGROUND_BLUR") {
    effects.push({ type, radius, visible: true } as BlurEffect);
  } else {
    const rgb = hexToRGB(hex);
    effects.push({
      type, radius, spread, visible: true,
      color: { r: rgb.r, g: rgb.g, b: rgb.b, a: opacity },
      offset: { x: offsetX, y: offsetY },
    } as DropShadowEffect);
  }
  n.effects = effects;
  return nodeInfo(n);
}

function clearEffects({ nodeId }: any) {
  const n = getNode(nodeId) as any;
  n.effects = [];
  return nodeInfo(n);
}

function layoutGridAdd({ nodeId, pattern = "COLUMNS", count = 12, gutterSize = 20, sectionSize = 80, hex = "#E5E7EB", opacity = 0.5 }: any) {
  const n = getNode(nodeId) as FrameNode;
  if (!("layoutGrids" in n)) throw new Error("Node does not support layoutGrids");
  const rgb = hexToRGB(hex);
  const grids = cloneArray(n.layoutGrids);
  grids.push({
    pattern, count, gutterSize, sectionSize, visible: true,
    color: { r: rgb.r, g: rgb.g, b: rgb.b, a: opacity },
  } as LayoutGrid);
  n.layoutGrids = grids;
  return nodeInfo(n);
}

function layoutGridClear({ nodeId }: any) {
  const n = getNode(nodeId) as any;
  n.layoutGrids = [];
  return nodeInfo(n);
}

// ── Auto Layout & Constraints ──

function setAutoLayout(input: any) {
  const f = getNode(input.nodeId) as FrameNode;
  if (f.type !== "FRAME") throw new Error("Auto Layout only on frames");
  const allowed = [
    "layoutMode", "primaryAxisSizingMode", "counterAxisSizingMode",
    "itemSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "primaryAxisAlignItems", "counterAxisAlignItems", "layoutWrap", "counterAxisSpacing",
  ];
  for (const k of allowed) {
    if (k in input) (f as any)[k] = input[k];
  }
  return nodeInfo(f);
}

function setConstraints({ nodeId, horizontal, vertical }: any) {
  const n = getNode(nodeId) as SceneNode & ConstraintMixin;
  n.constraints = {
    horizontal: horizontal || n.constraints.horizontal,
    vertical: vertical || n.constraints.vertical,
  };
  return nodeInfo(n);
}

// ── Text ──

async function setTextContent({ nodeId, text }: any) {
  const t = getNode(nodeId) as TextNode;
  if (t.type !== "TEXT") throw new Error("Not a text node");
  const font = t.fontName;
  if (font && typeof font !== "symbol") await figma.loadFontAsync(font as FontName);
  t.characters = text;
  return nodeInfo(t);
}

async function setTextStyle({ nodeId, fontFamily, fontStyle, fontSize, lineHeight, letterSpacing, textAlignHorizontal, textAutoResize }: any) {
  const t = getNode(nodeId) as TextNode;
  if (t.type !== "TEXT") throw new Error("Not a text node");
  const fam = fontFamily || (typeof t.fontName !== "symbol" ? (t.fontName as FontName).family : "Inter");
  const sty = fontStyle || (typeof t.fontName !== "symbol" ? (t.fontName as FontName).style : "Regular");
  await figma.loadFontAsync({ family: fam, style: sty });
  t.fontName = { family: fam, style: sty };
  if (fontSize != null) t.fontSize = fontSize;
  if (lineHeight != null) t.lineHeight = { unit: "PIXELS", value: lineHeight };
  if (letterSpacing != null) t.letterSpacing = { unit: "PIXELS", value: letterSpacing };
  if (textAlignHorizontal) t.textAlignHorizontal = textAlignHorizontal;
  if (textAutoResize) t.textAutoResize = textAutoResize;
  return nodeInfo(t);
}

function setTextColor({ nodeId, hex, opacity }: any) {
  const t = getNode(nodeId) as TextNode;
  if (t.type !== "TEXT") throw new Error("Not a text node");
  const fill: SolidPaint = { type: "SOLID", color: hexToRGB(hex), opacity: typeof opacity === "number" ? Math.max(0, Math.min(1, opacity)) : 1 };
  t.fills = [fill];
  return nodeInfo(t);
}

// ── Components & Boolean ──

function createComponent({ name = "Component", fromNodeIds }: any) {
  const c = figma.createComponent();
  c.name = name;
  page().appendChild(c);
  if (Array.isArray(fromNodeIds) && fromNodeIds.length) {
    for (const id of fromNodeIds) c.appendChild(getNode(id));
  }
  return nodeInfo(c);
}

function createInstance({ componentId, x = 0, y = 0 }: any) {
  const c = getNode(componentId) as ComponentNode;
  if (c.type !== "COMPONENT") throw new Error("Not a component");
  const inst = c.createInstance();
  inst.x = x; inst.y = y;
  page().appendChild(inst);
  return nodeInfo(inst);
}

function detachInstance({ nodeId }: any) {
  const n = getNode(nodeId) as InstanceNode;
  if ("detachInstance" in n) return nodeInfo(n.detachInstance());
  throw new Error("Node is not an instance");
}

function booleanOp({ op, nodeIds, name = "Boolean" }: any) {
  const nodes = (nodeIds as string[]).map(getNode);
  const parent = (nodes[0].parent || page()) as BaseNode & ChildrenMixin;
  let res: BooleanOperationNode;
  switch (op) {
    case "UNION":     res = figma.union(nodes, parent); break;
    case "SUBTRACT":  res = figma.subtract(nodes, parent); break;
    case "INTERSECT": res = figma.intersect(nodes, parent); break;
    case "EXCLUDE":   res = figma.exclude(nodes, parent); break;
    default: throw new Error("Unknown boolean op: " + op);
  }
  res.name = name;
  return nodeInfo(res);
}

// ── Export / data / generic ──

async function exportNode({ nodeId, format = "PNG", scale = 1 }: any) {
  const n = getNode(nodeId);
  const bytes = await (n as any).exportAsync({ format, constraint: { type: "SCALE", value: scale } });
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { format, base64: btoa(binary) };
}

function setPluginData({ nodeId, key, value }: any) {
  getNode(nodeId).setPluginData(key, JSON.stringify(value));
  return { nodeId };
}

function getPluginData({ nodeId, key }: any) {
  const raw = getNode(nodeId).getPluginData(key);
  try {
    return { value: JSON.parse(raw) };
  } catch (_e) {
    return { value: raw };
  }
}

function setProperties({ nodeId, props }: any) {
  const n = getNode(nodeId) as any;
  const allowed = [
    "x", "y", "rotation", "opacity", "visible", "locked",
    "layoutAlign", "layoutGrow",
    "fills", "strokes", "strokeWeight", "strokeAlign", "dashPattern", "blendMode",
    "itemSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "primaryAxisAlignItems", "counterAxisAlignItems", "layoutMode",
    "primaryAxisSizingMode", "counterAxisSizingMode", "layoutWrap", "counterAxisSpacing",
    "textAlignHorizontal", "textAlignVertical",
  ];
  for (const k of Object.keys(props || {})) {
    if (allowed.includes(k)) {
      try { n[k] = props[k]; } catch (_e) { /* skip unsupported */ }
    }
  }
  return nodeInfo(n);
}
