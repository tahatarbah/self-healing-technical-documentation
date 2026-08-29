import type { DocPage, RepoIndex } from "./index.js";

export type DocRefKind =
  | "page"
  | "anchor"
  | "code_symbol"
  | "openapi_operation"
  | "openapi_path"
  | "source_file";

export interface DocGraphNode {
  id: string;
  kind: DocRefKind;
  label: string;
  path?: string;
}

export interface DocGraphEdge {
  from: string;
  to: string;
  relation: "links_to" | "documents" | "references" | "embeds";
}

export interface DocGraph {
  nodes: Map<string, DocGraphNode>;
  edges: DocGraphEdge[];
}

function nodeId(kind: DocRefKind, key: string): string {
  return `${kind}:${key}`;
}

/** Build a Doc Graph: pages → anchors / code refs / OpenAPI refs. */
export function buildDocGraph(index: RepoIndex): DocGraph {
  const nodes = new Map<string, DocGraphNode>();
  const edges: DocGraphEdge[] = [];

  const addNode = (node: DocGraphNode) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };

  for (const page of index.pages) {
    const pageId = nodeId("page", page.relPath);
    addNode({ id: pageId, kind: "page", label: page.relPath, path: page.relPath });

    for (const h of page.headings) {
      const aId = nodeId("anchor", `${page.relPath}#${h.slug}`);
      addNode({
        id: aId,
        kind: "anchor",
        label: h.text,
        path: `${page.relPath}#${h.slug}`,
      });
      edges.push({ from: pageId, to: aId, relation: "embeds" });
    }

    for (const sig of page.signatures) {
      const sId = nodeId("code_symbol", sig.name);
      addNode({ id: sId, kind: "code_symbol", label: sig.name });
      edges.push({ from: pageId, to: sId, relation: "documents" });
    }

    for (const op of page.openApiRefs.operationIds) {
      const oId = nodeId("openapi_operation", op);
      addNode({ id: oId, kind: "openapi_operation", label: op });
      edges.push({ from: pageId, to: oId, relation: "references" });
    }

    for (const p of page.openApiRefs.paths) {
      const key = `${p.method ?? "ANY"} ${p.path}`;
      const pId = nodeId("openapi_path", key);
      addNode({ id: pId, kind: "openapi_path", label: key });
      edges.push({ from: pageId, to: pId, relation: "references" });
    }

    for (const link of page.links) {
      if (link.href.startsWith("http://") || link.href.startsWith("https://")) {
        continue;
      }
      const target = resolveLinkTarget(page, link.href);
      if (target) {
        const targetPath = target.split("#")[0] ?? target;
        const known = index.pages.some((p) => p.relPath === targetPath);
        if (known) {
          const tId = nodeId("page", targetPath);
          addNode({ id: tId, kind: "page", label: targetPath, path: targetPath });
          edges.push({ from: pageId, to: tId, relation: "links_to" });
        } else {
          const tId = nodeId("source_file", target);
          addNode({
            id: tId,
            kind: "source_file",
            label: target,
            path: target,
          });
          edges.push({ from: pageId, to: tId, relation: "links_to" });
        }
      }
    }
  }

  for (const [, fn] of index.symbols.functions) {
    const sId = nodeId("code_symbol", fn.name);
    addNode({
      id: sId,
      kind: "code_symbol",
      label: fn.name,
      path: fn.fileRelPath,
    });
  }

  return { nodes, edges };
}

function resolveLinkTarget(page: DocPage, href: string): string | null {
  const [pathPart] = href.split("#");
  if (!pathPart || pathPart === "") {
    return page.relPath + href;
  }
  // leave absolute-ish for graph; detectors resolve properly
  return href;
}

export function summarizeGraph(graph: DocGraph): {
  nodeCount: number;
  edgeCount: number;
  pages: number;
} {
  let pages = 0;
  for (const n of graph.nodes.values()) {
    if (n.kind === "page") pages++;
  }
  return {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.length,
    pages,
  };
}
