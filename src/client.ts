const FIGMA_API_BASE = "https://api.figma.com/v1";

export interface FigmaClientOptions {
  personalAccessToken: string;
}

export class FigmaClient {
  private token: string;

  constructor(opts: FigmaClientOptions) {
    this.token = opts.personalAccessToken;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${FIGMA_API_BASE}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "X-Figma-Token": this.token,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Figma API ${res.status}: ${res.statusText} — ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async getFile(fileKey: string, opts?: { depth?: number }) {
    const params = new URLSearchParams();
    if (opts?.depth != null) params.set("depth", String(opts.depth));
    const qs = params.toString();
    return this.request<FigmaFileResponse>(`/files/${fileKey}${qs ? `?${qs}` : ""}`);
  }

  async getFileNodes(fileKey: string, nodeIds: string | string[]) {
    const ids = Array.isArray(nodeIds) ? nodeIds.join(",") : String(nodeIds);
    return this.request<FigmaFileNodesResponse>(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`);
  }

  async getImages(fileKey: string, nodeIds: string | string[], opts?: { format?: "png" | "jpg" | "svg" | "pdf"; scale?: number }) {
    const params = new URLSearchParams();
    params.set("ids", Array.isArray(nodeIds) ? nodeIds.join(",") : String(nodeIds));
    if (opts?.format) params.set("format", opts.format);
    if (opts?.scale != null) params.set("scale", String(opts.scale));
    return this.request<FigmaImagesResponse>(`/images/${fileKey}?${params.toString()}`);
  }

  async getFileComponents(fileKey: string) {
    return this.request<FigmaComponentsResponse>(`/files/${fileKey}/components`);
  }

  async getFileStyles(fileKey: string) {
    return this.request<FigmaStylesResponse>(`/files/${fileKey}/styles`);
  }

  async getComments(fileKey: string) {
    return this.request<FigmaCommentsResponse>(`/files/${fileKey}/comments`);
  }

  async postComment(fileKey: string, message: string, opts?: { nodeId?: string; x?: number; y?: number }) {
    const body: Record<string, unknown> = { message };
    if (opts?.nodeId) {
      body.client_meta = { node_id: opts.nodeId, node_offset: { x: opts.x ?? 0, y: opts.y ?? 0 } };
    }
    return this.request<FigmaComment>(`/files/${fileKey}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

// Figma API response types (minimal)

export interface FigmaFileResponse {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaNode;
  components: Record<string, FigmaComponentMeta>;
  styles: Record<string, FigmaStyleMeta>;
}

export interface FigmaFileNodesResponse {
  nodes: Record<string, { document: FigmaNode; components: Record<string, FigmaComponentMeta>; styles: Record<string, FigmaStyleMeta> } | null>;
}

export interface FigmaImagesResponse {
  images: Record<string, string | null>;
}

export interface FigmaComponentsResponse {
  meta: { components: FigmaComponentMeta[] };
}

export interface FigmaStylesResponse {
  meta: { styles: FigmaStyleMeta[] };
}

export interface FigmaCommentsResponse {
  comments: FigmaComment[];
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  [key: string]: unknown;
}

export interface FigmaComponentMeta {
  key: string;
  name: string;
  description: string;
  node_id?: string;
  containing_frame?: { name: string; nodeId: string };
}

export interface FigmaStyleMeta {
  key: string;
  name: string;
  style_type: string;
  description: string;
  node_id?: string;
}

export interface FigmaComment {
  id: string;
  message: string;
  created_at: string;
  user: { handle: string; id: string };
  order_id?: number;
}
